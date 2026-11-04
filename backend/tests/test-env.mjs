import { randomBytes } from 'node:crypto';

const randomCredential = () => randomBytes(32).toString('hex');

export const testCredentials = {
  studioPasscode: randomCredential(),
  whatsappVerifyToken: randomCredential(),
  instagramVerifyToken: randomCredential(),
};

process.env.NODE_ENV = 'test';
process.env.STUDIO_PASSCODE = testCredentials.studioPasscode;
process.env.WHATSAPP_VERIFY_TOKEN = testCredentials.whatsappVerifyToken;
process.env.INSTAGRAM_VERIFY_TOKEN = testCredentials.instagramVerifyToken;
