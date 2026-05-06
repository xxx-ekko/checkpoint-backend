require('dotenv').config();
const { Resend } = require('resend');
const Ticket = require('../models/Ticket'); // Make sure this path is correct for your project

// Initialize Resend securely using the environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

// Handle ticket creation, database saving, and email sending
const createTicket = async (req, res) => {
    const { attendeeName, email } = req.body;

    if (!attendeeName || !email) {
        return res.status(400).json({ success: false, message: 'Missing attendee data.' });
    }

    try {
        // 1. Save the ticket to your PostgreSQL database using Sequelize
        // Assuming your Ticket model has name, email, and status fields
        const newTicket = await Ticket.create({
            attendeeName: attendeeName,
            email: email,
            status: 'PENDING'
        });

        // 2. Generate the unique QR Code URL (using the database ID makes it highly secure)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CHECKPOINT_${newTicket.id}_${encodeURIComponent(attendeeName)}&color=9E1B1B&bgcolor=1A1A1A`;

        // 3. Send the Transactional Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev', // Testing mode sender
            to: [email], // Ensure this matches your Resend registered email during testing
            subject: 'ACCÈS AUTORISÉ : Votre Pass Le Checkpoint',
            html: `
        <div style="background-color: #131313; color: #e2e2e2; font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px; text-align: center;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1A1A1A; border: 1px solid #333; padding: 40px; text-align: center;">
            <h1 style="color: #ffffff; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
              LE <span style="color: #9E1B1B;">CHECKPOINT</span>
            </h1>
            <hr style="border-color: #9E1B1B; margin: 20px 0; border-style: solid; border-width: 1px 0 0 0;">
            <h2 style="color: #9E1B1B; letter-spacing: 1px; text-transform: uppercase;">STATUT : ACCÈS AUTORISÉ</h2>
            
            <p style="font-size: 16px; line-height: 1.6; color: #c6c6c7; margin-bottom: 30px;">
              Félicitations <strong>${attendeeName}</strong>. Votre place dans la Safe Zone est confirmée.
              Veuillez présenter le QR code ci-dessous à l'entrée.
            </p>
            
            <div style="background-color: #131313; padding: 20px; display: inline-block; border: 2px solid #9E1B1B; margin-bottom: 30px;">
              <img src="${qrCodeUrl}" alt="Votre Pass QR Code" style="width: 200px; height: 200px; display: block;">
            </div>
            
            <p style="font-size: 14px; color: #888;">
              ⚠️ Ce pass est unique. Toute tentative de duplication sera bloquée par le scanner de sécurité.
            </p>
            <hr style="border-color: #333; margin: 30px 0 20px; border-style: solid; border-width: 1px 0 0 0;">
            <p style="font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 1px;">
              © 2026 Otaku Senegal // Mind7 Company
            </p>
          </div>
        </div>
      `,
        });

        if (error) {
            console.error('Resend Error:', error);
            return res.status(500).json({ success: false, message: 'Failed to send email pass.' });
        }

        return res.status(200).json({
            success: true,
            qrCode: qrCodeUrl,
            ticketId: newTicket.id
        });

    } catch (err) {
        console.error('Server Error:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error.' });
    }
};

// Function to verify the ticket scanner by the security team
const verifyTicket = async (req, res) => {
    const { ticketId } = req.body;

    try {
        // 1. Find the ticket in the PostgreSQL database using Sequelize
        const ticket = await Ticket.findByPk(ticketId);

        // 2. If the ID doesn't exist at all, it's a fake QR code
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'TICKET INTROUVABLE / FAUX PASS'
            });
        }

        // 3. FRAUD ALERT: Check the isScanned boolean from your schema
        if (ticket.isScanned) {
            return res.status(403).json({
                success: false,
                message: 'TICKET DÉJÀ SCANNÉ',
                ticket: ticket
            });
        }

        // 4. SUCCESS: Mark it as scanned using your exact database column
        ticket.isScanned = true;
        await ticket.save();

        // 5. Send the green light to the frontend
        return res.status(200).json({
            success: true,
            ticket: ticket
        });

    } catch (err) {
        console.error('Verification Server Error:', err);
        return res.status(500).json({ success: false, message: 'ERREUR BASE DE DONNÉES' });
    }
};

// Exporting with the exact names your server.js expects
module.exports = {
    createTicket,
    verifyTicket
};