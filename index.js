const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceKey.json');

const app = express();
const port = process.env.PORT || 3000;

// ---------- MIDDLEWARE ----------
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// ---------- FIREBASE ADMIN ----------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ---------- ROOT ROUTE ----------
app.get('/', (req, res) => {
  res.send('Smart server is running');
});

// ---------- MONGODB CONNECTION ----------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ilappos.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ---------- AUTH MIDDLEWARE ----------
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: 'unauthorized access. Token not found',
    });
  }

  
  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).send({
      message: 'unauthorized access. Invalid token format',
    });
  }

  try {
    

    const decoded = await admin.auth().verifyIdToken(token);
    
    req.decodedUser = decoded;
    next();
  } catch (error) {
    console.error('TOKEN VERIFY ERROR:', error);
    return res.status(401).send({
      message: 'unauthorized access',
    });
  }
};

// ---------- MAIN APP LOGIC ----------
async function run() {
  try {
    await client.connect();
    const db = client.db('art_db');
    const artsCollection = db.collection('arts');
    const usersCollection = db.collection('users');
    const favoritesCollection = db.collection('favorites');

    console.log('Connected to MongoDB successfully!');

    // ----------------- ROUTES -----------------

    // Create user
    app.post('/users', async (req, res) => {
      try {
        const newUser = req.body;
        const existingUser = await usersCollection.findOne({ email: newUser.email });

        if (existingUser) {
          return res.send({ message: 'User already exists.' });
        }

        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Get all artworks (optional filter by email)
    app.get('/arts', async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { email } : {};
        const result = await artsCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Featured Arts (limit 6)
    app.get('/featured-arts', async (req, res) => {
      try {
        const result = await artsCollection
          .find()
          .sort({ createdAt: 1 }) 
          .limit(6)
          .toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Get single art by ID (protected)
    app.get('/arts/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid art ID',
          });
        }

        const objectId = new ObjectId(id);
        const result = await artsCollection.findOne({ _id: objectId });

        if (!result) {
          return res.status(404).send({
            success: false,
            message: 'Art not found',
          });
        }

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({
          success: false,
          message: 'Server error',
        });
      }
    });

    // Add new art
    app.post('/arts', async (req, res) => {
      try {
        const artData = req.body;
        const result = await artsCollection.insertOne(artData);
        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    // Update art 
    app.put('/arts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid art ID',
          });
        }

        const objectId = new ObjectId(id);
        const filter = { _id: objectId };
        const update = { $set: req.body };
        const result = await artsCollection.updateOne(filter, update);

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    // Patch art (partial update)
    app.patch('/arts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid art ID',
          });
        }

        const objectId = new ObjectId(id);
        const update = { $set: req.body };
        const result = await artsCollection.updateOne({ _id: objectId }, update);

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    // Delete art
    app.delete('/arts/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid art ID',
          });
        }

        const objectId = new ObjectId(id);
        const result = await artsCollection.deleteOne({ _id: objectId });

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    

    // Add favorite
    app.post('/favorites', async (req, res) => {
      try {
        const data = req.body;
        const result = await favoritesCollection.insertOne(data);
        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    // Get favorites by user email
    app.get('/my-favorites', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({
            success: false,
            message: 'Email query param is required',
          });
        }

        const result = await favoritesCollection
          .find({ added_by: email })
          .toArray();

        res.send({ success: true, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    // ------------------------------------------------
  } finally {
   
  }
}


run()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port: ${port}`);
    });
  })
  .catch(console.error);
