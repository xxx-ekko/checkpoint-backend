require('dotenv').config();
const { Resend } = require('resend');
const QRCode = require('qrcode'); // FIX: Added the missing QRCode import
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

// Generate a ticket manually from the Admin panel
const generateTicket = async (req, res) => {
    try {
        const { firstName, lastName } = req.body;

        // 1. Combine first and last name to match your database schema
        const fullName = `${firstName} ${lastName}`.trim();
        const fakeEmail = `wa-${Date.now()}@checkpoint.local`;

        // 2. Save the ticket to your PostgreSQL database FIRST to get the real ID
        const newTicket = await Ticket.create({
            attendeeName: fullName,
            email: fakeEmail, // Bypass the notNull constraint
            status: 'VALID'
        });

        // 3. Format the URL using the REAL database ID (newTicket.id)
        const frontendUrl = process.env.FRONTEND_URL;
        const scannerUrl = `${frontendUrl}/scanner/${ticketId}`;

        // 4. Generate the QR code image
        const qrCodeImage = await QRCode.toDataURL(scannerUrl, {
            color: {
                dark: '#9E1B1B',  // Checkpoint Red
                light: '#ffffff'  // White background
            },
            width: 300,
            margin: 2
        });

        console.log(`[+] Ticket created for ${fullName} with DB ID: ${newTicket.id}`);

        // 5. Send back to React
        res.json({
            success: true,
            qrCode: qrCodeImage,
            ticketId: newTicket.id
        });

    } catch (error) {
        console.error('Error generating ticket:', error);
        res.status(500).json({ success: false, message: 'Server error during generation' });
    }
};

// Fetch ticket information for the scanner verification page
const getTicketInfo = async (req, res) => {
    try {
        const { ticketId } = req.params;

        // Use findByPk to match how your DB handles IDs (just like verifyTicket does)
        const ticket = await Ticket.findByPk(ticketId);

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket introuvable" });
        }

        res.json({
            success: true,
            ticket: ticket
        });

    } catch (error) {
        console.error('Error fetching ticket info:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Change deleteTicket to perform a "Soft Delete" (Move to trash)
const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await Ticket.findByPk(id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket introuvable" });
        }

        // Instead of destroy(), we change the status
        ticket.status = 'DELETED';
        await ticket.save();

        res.json({ success: true, message: "Ticket mis à la corbeille" });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ success: false, message: 'Server error during deletion' });
    }
};

// Fetch tickets that are in the trash
const getTrashTickets = async (req, res) => {
    try {
        const tickets = await Ticket.findAll({
            where: { status: 'DELETED' },
            order: [['updatedAt', 'DESC']]
        });
        res.json({ success: true, tickets: tickets });
    } catch (error) {
        console.error('Error fetching trash:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Restore a ticket from the trash
const restoreTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await Ticket.findByPk(id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket introuvable" });
        }

        // Set status back to VALID
        ticket.status = 'VALID';
        await ticket.save();

        res.json({ success: true, message: "Ticket restauré" });
    } catch (error) {
        console.error('Error restoring ticket:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Modifie aussi getRecentTickets pour ne pas afficher ceux de la corbeille !
const getRecentTickets = async (req, res) => {
    try {
        const tickets = await Ticket.findAll({
            where: { status: 'VALID' }, // ONLY SHOW VALID ONES HERE
            order: [['createdAt', 'DESC']],
            limit: 10
        });
        res.json({ success: true, tickets: tickets });
    } catch (error) {
        console.error('Error fetching recent tickets:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// FIX: Exporting ALL functions properly in a single object at the end of the file
module.exports = {
    createTicket,
    verifyTicket,
    generateTicket,
    getTicketInfo,
    getRecentTickets,
    deleteTicket,
    getTrashTickets,
    restoreTicket
};