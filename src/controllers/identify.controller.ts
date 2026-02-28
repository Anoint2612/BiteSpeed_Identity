import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const identify = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            res.status(400).json({ error: 'Email or phoneNumber is required' });
            return;
        }

        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;

        // Start transaction for consistency
        const result = await prisma.$transaction(async (tx) => {
            // Find direct matches
            const matches = await tx.contact.findMany({
                where: {
                    OR: [
                        ...(emailStr ? [{ email: emailStr }] : []),
                        ...(phoneStr ? [{ phoneNumber: phoneStr }] : [])
                    ]
                }
            });

            if (matches.length === 0) {
                // No matches, create a primary
                const newContact = await tx.contact.create({
                    data: {
                        email: emailStr,
                        phoneNumber: phoneStr,
                        linkPrecedence: 'primary'
                    }
                });
                return {
                    contact: {
                        primaryContactId: newContact.id,
                        emails: newContact.email ? [newContact.email] : [],
                        phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                        secondaryContactIds: []
                    }
                };
            }

            // We have matches. Find all connected components
            let currentIds = new Set<number>(matches.map(m => m.id));
            let previousSize = 0;

            while (currentIds.size > previousSize) {
                previousSize = currentIds.size;
                const related = await tx.contact.findMany({
                    where: {
                        OR: [
                            { id: { in: Array.from(currentIds) } },
                            { linkedId: { in: Array.from(currentIds) } }
                        ]
                    }
                });
                for (const r of related) {
                    currentIds.add(r.id);
                    if (r.linkedId) currentIds.add(r.linkedId);
                }
            }

            // Fetch fully resolved cluster
            let cluster = await tx.contact.findMany({
                where: { id: { in: Array.from(currentIds) } },
                orderBy: { createdAt: 'asc' }
            });

            // The oldest is the primary
            const oldestContact = cluster[0];

            let hasNewEmail = emailStr && !cluster.some(c => c.email === emailStr);
            let hasNewPhone = phoneStr && !cluster.some(c => c.phoneNumber === phoneStr);

            // Turn other primaries into secondaries and point them to oldestContact
            let needsUpdate = false;
            const updates = [];
            for (let i = 1; i < cluster.length; i++) {
                if (cluster[i].linkPrecedence === 'primary' || cluster[i].linkedId !== oldestContact.id) {
                    updates.push(
                        tx.contact.update({
                            where: { id: cluster[i].id },
                            data: {
                                linkPrecedence: 'secondary',
                                linkedId: oldestContact.id
                            }
                        })
                    );
                    cluster[i].linkPrecedence = 'secondary';
                    cluster[i].linkedId = oldestContact.id;
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }

            // Create new secondary if new info introduced
            if (hasNewEmail || hasNewPhone) {
                const newSecondary = await tx.contact.create({
                    data: {
                        email: emailStr,
                        phoneNumber: phoneStr,
                        linkedId: oldestContact.id,
                        linkPrecedence: 'secondary'
                    }
                });
                cluster.push(newSecondary);
            }

            // Formatting the response
            const emails = new Set<string>();
            const phoneNumbers = new Set<string>();
            const secondaryContactIds: number[] = [];

            // Primary email & phone appear first
            if (oldestContact.email) emails.add(oldestContact.email);
            if (oldestContact.phoneNumber) phoneNumbers.add(oldestContact.phoneNumber);

            for (const c of cluster) {
                if (c.email) emails.add(c.email);
                if (c.phoneNumber) phoneNumbers.add(c.phoneNumber);
                if (c.id !== oldestContact.id) {
                    secondaryContactIds.push(c.id);
                }
            }

            return {
                contact: {
                    primaryContactId: oldestContact.id,
                    emails: Array.from(emails),
                    phoneNumbers: Array.from(phoneNumbers),
                    secondaryContactIds
                }
            };
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in identify handler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
