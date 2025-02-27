// ---------------------------------------------------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------------------------------------------------

const express = require('express');
const crypto = require('crypto');
const app = express();
const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');
const {promisify} = require('util');

// ---------------------------------------------------------------------------------------------------------------------
// Server initialization
// ---------------------------------------------------------------------------------------------------------------------

const PORT = 1984;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, "../../storage");

const CARD_ID_LENGTH = 32;

const config = {shell: '/bin/sh'};

// ---------------------------------------------------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------------------------------------------------
function resolveCardFilename(cardId, ext = "html") {
    return path.join(STORAGE_PATH, `${cardId}.${ext}`);
}

function isValidCardId(cardId) {
    return cardId !== undefined &&
        typeof cardId === 'string' &&
        cardId.length === CARD_ID_LENGTH &&
        /^[0-9a-f]+$/.test(cardId) &&
        fs.existsSync(resolveCardFilename(cardId));
}

// ---------------------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------------------
app.get('/', (req, res) => {
    res.send('The save2pdf server app is running...');
});

app.get('/make-card-pdf', async (req, res) => {

    const data = req.query.data;

    if (!data || typeof data !== 'string') {
        console.warn("Wrong arguments")
        return res.status(401).send('Wrong arguments');
    }

    const parts = data.split(' ');
    if (parts.length !== 2) {
        console.warn('Malformed data')
        return res.status(401).send('Malformed data');
    }

    const [email, cardId] = [parts[0], parts[1]];

    if (!isValidCardId(cardId)) {
        console.warn('Invalid data')
        return res.status(401).send('Invalid data');
    }

    const htmlFile = path.join(STORAGE_PATH, `${cardId}.html`);
    const pdfFile = path.join('/tmp/', `${cardId}-${crypto.randomBytes(8).toString('hex')}.pdf`);
    const cmdWkhtmltopdf = `wkhtmltopdf --title '${email}' ${htmlFile} ${pdfFile}`;
    try {
        const execAsync = promisify(exec);
        await execAsync(cmdWkhtmltopdf, {shell: config.shell});
        res.sendFile(pdfFile);
    } catch (pdfErr) {
        console.error(`Command failed: ${cmdWkhtmltopdf}`);
        res.status(501).send(`Command failed: ${cmdWkhtmltopdf}`);
    }
});

// ---------------------------------------------------------------------------------------------------------------------
// Starting the server!
// ---------------------------------------------------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`save2pf is listening at http://localhost:${PORT}`);
});
