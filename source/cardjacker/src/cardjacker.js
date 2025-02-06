// ---------------------------------------------------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------------------------------------------------
const express = require('express');
const nunjucks = require('nunjucks');
const {query, body, validationResult} = require('express-validator');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

// ---------------------------------------------------------------------------------------------------------------------
// Express app initialization
// ---------------------------------------------------------------------------------------------------------------------

const app = express();
const PORT = 2025;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

app.use(express.urlencoded({extended: true}));

// ---------------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------------

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
const CARD_ID_LENGTH = 32;

// ---------------------------------------------------------------------------------------------------------------------
// Template engine configs
// ---------------------------------------------------------------------------------------------------------------------

const env = nunjucks.configure(path.join(__dirname, 'views'), {
    autoescape: true,
    express: app
});

function renderUrlAsAvatar(url) {
    const isValidHttpOrHttpsUrl = /^(http:\/\/|https:\/\/)/.test(url);
    const html = isValidHttpOrHttpsUrl
        ? `<div style="border-radius: 50%;overflow: hidden;width: 100%;"><img src="${url}" style="width: 100%; height: 100%; object-fit: cover;"/></div>`
        : "<b>N/A</b>";
    return html;
}

env.addFilter('renderUrlAsAvatar', renderUrlAsAvatar);

app.set('view engine', 'html');

// ---------------------------------------------------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------------------------------------------------

function resolveCardFilename(cardId, ext = "html") {
    return path.join(STORAGE_PATH, `${cardId}.${ext}`);
}

function generateRandomCardId() {
    return crypto.createHash('sha512')
        .update(Math.random().toString())
        .digest('hex')
        .toLowerCase()
        .slice(0, CARD_ID_LENGTH);
}

// ---------------------------------------------------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------------------------------------------------

function isValidCardId(cardId) {
    if (typeof cardId !== "string") return false;
    return cardId.length === CARD_ID_LENGTH &&
        /^[0-9a-f]+$/.test(cardId) &&
        fs.existsSync(resolveCardFilename(cardId, "html"));
}

const isTextContainingOnlyAlphabeticAndSpaces = (text) => {
    if (typeof text !== "string") return false;
    if (/^[a-zA-Z\s]+$/.test(text) === false) {
        throw new Error('');
    }
    return true;
}

function isLikelyValidGitHubHandle(username) {
    if (typeof username !== "string") return false;
    const regex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
    return regex.test(username);
}

async function isValidGitHubHandle(githubHandle) {
    // Trick: checking if the Github handle is valid by verifying the existence of a profile pic
    try {
        const githubProfilePicUrl = `https://github.com/${githubHandle}.png`;
        return (await axios.get(githubProfilePicUrl, {maxRedirects: 2})).status === 200;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------------------

app.get('/', (req, res) => {
    res.redirect(`/create-card`);
});

app.get('/create-card', (req, res) => {
    res.render('create-card.twig');
});

app.post('/create-card', [
        body('firstName')
            .notEmpty()
            .withMessage('First name is required')
            .custom(isTextContainingOnlyAlphabeticAndSpaces)
            .withMessage('First name is invalid'),
        body('lastName').notEmpty()
            .withMessage('Last name is required')
            .custom(isTextContainingOnlyAlphabeticAndSpaces)
            .withMessage('Last name is invalid'),
        body('email')
            .isEmail()
            .withMessage('Invalid email address'),
        body('github').notEmpty()
            .withMessage('Github handle is required')
            .custom(isLikelyValidGitHubHandle)
            .withMessage('Invalid Github handle'),
        body('company').notEmpty()
            .withMessage('Company is required')
            .custom(isTextContainingOnlyAlphabeticAndSpaces)
            .withMessage('Company is invalid'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('error.twig', {
                success: false,
                message: "Validation failed",
                errors: errors.array()
            });
        }

        const userData = {};

        const userAttribs = ['firstName', 'lastName', 'email', 'github']
        for (const attr of userAttribs) {
            userData[attr] = req.body[attr];
        }

        const companyData = {};
        for (let attr in req.body) {
            if (attr in userAttribs) continue;
            companyData[attr] = req.body[attr];
        }

        userData.getAvatarUrl = async function () {
            // Lazy memoized construction of avatarUrl
            if (typeof this.avatarUrl == "undefined") {
                if (await isValidGitHubHandle(this.github)) {
                    this.avatarUrl = `https://github.com/${this.github}.png`
                } else {
                    // Using a fake avatar with the same dims as Github ones
                    this.avatarUrl = `https://i.pravatar.cc/400?u=${this.email}`;
                }
            }

            return this.avatarUrl;
        };

        const {email} = req.body;
        const cardId = generateRandomCardId();

        let html;
        try {
            html = env.render('card.twig', {
                userData: userData,
                userAvatarUrl: await userData.getAvatarUrl(),
                companyData: companyData
            });
        } catch (err) {
            console.error('Error rendering card:', err);
            return res.status(500).send('Error rendering card');
        }

        // Save rendered HTML to a file
        const filePath = resolveCardFilename(cardId, "html");
        try {
            fs.writeFileSync(filePath, html);
            res.redirect(`/view-card?cardId=${cardId}&email=${email}`);
        } catch (err) {
            console.error('Error writing file:', err);
            return res.status(500).send('Error saving card');
        }

    }
);

app.get('/view-card', [
        query('cardId')
            .notEmpty()
            .withMessage('Query param cardId is required')
            .custom(isValidCardId)
            .withMessage('Invalid cardId'),
        query('email')
            .notEmpty()
            .withMessage('Email address is required')
            .isEmail()
            .withMessage('Invalid email address')
    ],
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('error.twig', {
                success: false,
                message: "Validation failed",
                errors: errors.array()
            });
        }

        const cardId = req.query.cardId;

        res.render('card-viewer.twig', {
            cardId: cardId,
            email: req.query.email,
        });
    });

app.get('/preview-card', [
    query('cardId')
        .notEmpty()
        .withMessage('Query param cardId is required')
        .custom(isValidCardId)
        .withMessage('Invalid cardId'),
], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('error.twig', {
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }

    const cardId = req.query.cardId;

    const filePath = resolveCardFilename(cardId, "html");

    try {

        // Read the file as text
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Set the Content-Type header to indicate that the response contains HTML
        res.setHeader('Content-Type', 'text/html');
        // Send the file content as the response body
        res.send(fileContent);
    } catch (error) {
        res.status(500).render('error.twig', {
            message: "Internal Server Error",
            code: 500,
        });
    }
});

app.get('/download-card', [
    query('cardId')
        .notEmpty()
        .withMessage('Query param cardId is required')
        .custom(isValidCardId)
        .withMessage('Invalid cardId'),
    query('email')
        .notEmpty()
        .withMessage('Email address is required')
        .isEmail()
        .withMessage('Invalid email address'),
], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('error.twig', {
            success: false,
            message: "Validation failed",
            errors: errors.array()
        })
    }

    const cardId = req.query.cardId;
    const email = req.query.email;
    const cardPdf = resolveCardFilename(cardId, "pdf");

    if (!fs.existsSync(cardPdf)) {
        try {
            const url = `http://localhost:1984/make-card-pdf?data=${email}%20${cardId}`;
            const response = await axios.get(url, {responseType: "arraybuffer"});
            fs.writeFileSync(cardPdf, response.data);
        } catch (error) {
            console.error(error.message)
            res.status(500).render('error.twig', {
                message: "Error generating PDF",
                code: 500,
            });
            return;
        }
    }
    res.sendFile(cardPdf);
});

// ---------------------------------------------------------------------------------------------------------------------
// Starting app
// ---------------------------------------------------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`cardjacker is listening at http://localhost:${PORT}`);
});