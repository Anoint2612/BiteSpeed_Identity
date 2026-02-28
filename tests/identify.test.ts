import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';

describe('POST /identify', () => {
    beforeEach(async () => {
        await prisma.contact.deleteMany({});
    });

    afterAll(async () => {
        await prisma.contact.deleteMany({});
        await prisma.$disconnect();
    });

    it('1. New user: should create a new primary contact', async () => {
        const res = await request(app)
            .post('/api/identify')
            .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toEqual(['lorraine@hillvalley.edu']);
        expect(res.body.contact.phoneNumbers).toEqual(['123456']);
        expect(res.body.contact.secondaryContactIds).toEqual([]);

        const count = await prisma.contact.count();
        expect(count).toBe(1);
    });

    it('2. Same user repeat: should not create a new contact (idempotency)', async () => {
        await request(app)
            .post('/api/identify')
            .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

        const res = await request(app)
            .post('/api/identify')
            .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toEqual(['mcfly@hillvalley.edu']);
        expect(res.body.contact.phoneNumbers).toEqual(['123456']);
        expect(res.body.contact.secondaryContactIds).toEqual([]);

        const count = await prisma.contact.count();
        expect(count).toBe(1);
    });

    it('3. New email with same phone: should create a secondary contact', async () => {
        const res1 = await request(app)
            .post('/api/identify')
            .send({ email: 'doc@brown.com', phoneNumber: '987654' });

        const primaryId = res1.body.contact.primaryContactId;

        const res2 = await request(app)
            .post('/api/identify')
            .send({ email: 'emmett@brown.com', phoneNumber: '987654' });

        expect(res2.status).toBe(200);
        expect(res2.body.contact.primaryContactId).toBe(primaryId);
        expect(res2.body.contact.emails).toContain('doc@brown.com');
        expect(res2.body.contact.emails).toContain('emmett@brown.com');
        expect(res2.body.contact.phoneNumbers).toEqual(['987654']);
        expect(res2.body.contact.secondaryContactIds.length).toBe(1);

        const count = await prisma.contact.count();
        expect(count).toBe(2);
    });

    it('4. New phone with same email: should create a secondary contact', async () => {
        const res1 = await request(app)
            .post('/api/identify')
            .send({ email: 'biff@tannen.com', phoneNumber: '111111' });
        const primaryId = res1.body.contact.primaryContactId;

        const res2 = await request(app)
            .post('/api/identify')
            .send({ email: 'biff@tannen.com', phoneNumber: '222222' });

        expect(res2.status).toBe(200);
        expect(res2.body.contact.primaryContactId).toBe(primaryId);
        expect(res2.body.contact.phoneNumbers).toContain('111111');
        expect(res2.body.contact.phoneNumbers).toContain('222222');
        expect(res2.body.contact.emails).toEqual(['biff@tannen.com']);
        expect(res2.body.contact.secondaryContactIds.length).toBe(1);

        const count = await prisma.contact.count();
        expect(count).toBe(2);
    });

    it('5. Two primaries merging: oldest remains primary, newest becomes secondary', async () => {
        await request(app)
            .post('/api/identify')
            .send({ email: 'george@hillvalley.edu', phoneNumber: '888888' });

        await request(app)
            .post('/api/identify')
            .send({ email: 'g.mcfly@hillvalley.edu', phoneNumber: '999999' });

        const res = await request(app)
            .post('/api/identify')
            .send({ email: 'g.mcfly@hillvalley.edu', phoneNumber: '888888' });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails.length).toBe(2);
        expect(res.body.contact.phoneNumbers.length).toBe(2);

        const count = await prisma.contact.count();
        expect(count).toBe(2);

        const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'asc' } });
        expect(contacts[0].linkPrecedence).toBe('primary');
        expect(contacts[1].linkPrecedence).toBe('secondary');
        expect(contacts[1].linkedId).toBe(contacts[0].id);
    });

    it('6. Null email: should query and link by phone only', async () => {
        await request(app)
            .post('/api/identify')
            .send({ email: 'nulltest@example.com', phoneNumber: '000000' });

        const res = await request(app)
            .post('/api/identify')
            .send({ email: null, phoneNumber: '000000' });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toEqual(['nulltest@example.com']);
        expect(res.body.contact.phoneNumbers).toEqual(['000000']);
        expect(res.body.contact.secondaryContactIds).toEqual([]);

        const count = await prisma.contact.count();
        expect(count).toBe(1);
    });

    it('7. Null phone: should query and link by email only', async () => {
        await request(app)
            .post('/api/identify')
            .send({ email: 'onlyemail@example.com', phoneNumber: '555555' });

        const res = await request(app)
            .post('/api/identify')
            .send({ email: 'onlyemail@example.com', phoneNumber: null });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toEqual(['onlyemail@example.com']);
        expect(res.body.contact.phoneNumbers).toEqual(['555555']);
        expect(res.body.contact.secondaryContactIds).toEqual([]);

        const count = await prisma.contact.count();
        expect(count).toBe(1);
    });

    it('8. Repeated merging scenario (Idempotency check)', async () => {
        await request(app).post('/api/identify').send({ email: 'cluster@test.com', phoneNumber: '333333' });
        await request(app).post('/api/identify').send({ email: 'cluster-new@test.com', phoneNumber: '444444' });

        const merge1 = await request(app).post('/api/identify').send({ email: 'cluster-new@test.com', phoneNumber: '333333' });

        const merge2 = await request(app).post('/api/identify').send({ email: 'cluster-new@test.com', phoneNumber: '333333' });

        expect(merge1.body.contact).toEqual(merge2.body.contact);
        expect(merge1.body.contact.secondaryContactIds.length).toBe(1);

        const count = await prisma.contact.count();
        expect(count).toBe(2);
    });
});
