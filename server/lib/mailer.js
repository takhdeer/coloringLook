const nodemailer = require('nodemailer');

// Sends through a Gmail account using an App Password (GMAIL_USER / GMAIL_APP_PASSWORD in server/.env)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendInvite({ to, inviterName, groupName, joinUrl }) {
    const subject = `${inviterName} invited you to "${groupName}" on ColoringLook`;
    const text = `${inviterName} invited you to colour "${groupName}" together on ColoringLook.\n\nJoin the group: ${joinUrl}`;
    const html = `
        <p><strong>${escapeHtml(inviterName)}</strong> invited you to colour
        <strong>${escapeHtml(groupName)}</strong> together on ColoringLook.</p>
        <p><a href="${escapeHtml(joinUrl)}">Join the group</a></p>`;

    return transporter.sendMail({
        from: `ColoringLook <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html,
    });
}

module.exports = { sendInvite };
