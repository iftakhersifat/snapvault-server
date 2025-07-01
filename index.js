require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log('Uploads folder created');
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mojyanw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let mediaCollection;

async function connectDB() {
  await client.connect();
  const db = client.db('snapVaultDB');
  mediaCollection = db.collection('media');
  console.log('Connected to MongoDB');
}

connectDB().catch(console.error);

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Routes

// Root route
app.get('/', (req, res) => {
  res.send('snap-vault-server is running');
});

// Upload media (file + metadata)
app.post('/media', upload.single('media'), async (req, res) => {
  try {
    const { title, type, isPrivate } = req.body;
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const mediaDoc = {
      title: title || req.file.originalname,
      type,
      url: `/uploads/${req.file.filename}`, // relative url for frontend
      isPrivate: isPrivate === 'true',
      createdAt: new Date(),
    };

    const result = await mediaCollection.insertOne(mediaDoc);
    res.json({ success: true, mediaId: result.insertedId, media: mediaDoc });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to upload media');
  }
});

// Get public media list
app.get('/media', async (req, res) => {
  try {
    const mediaList = await mediaCollection.find({ isPrivate: false }).toArray();
    res.json(mediaList);
  } catch (err) {
    res.status(500).send('Failed to fetch media');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
