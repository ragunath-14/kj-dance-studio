const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize the client with LocalAuth to persist session
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // For Windows, puppeteer usually finds Chrome automatically. 
        // If it fails, you might need to specify executablePath.
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', (qr) => {
    console.log('\n---------------------------------------------------------');
    console.log('📲 SCAN THIS QR CODE WITH YOUR WHATSAPP APP');
    console.log('---------------------------------------------------------');
    qrcode.generate(qr, { small: true });
    console.log('---------------------------------------------------------\n');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Web Client is READY!');
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Web Authenticated!');
});

client.on('auth_failure', msg => {
    console.error('❌ WhatsApp Web Auth failure', msg);
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Web Client was disconnected', reason);
});

// Start initialization
client.initialize();

module.exports = client;
