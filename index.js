const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Smart server is running');
});

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ilappos.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    const db = client.db('art_db');
    const artsCollection = db.collection('arts');
    const usersCollection = db.collection('users');

    console.log('Connected to MongoDB successfully!');

    // ----------------- Routes -----------------

    // Create user
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const existingUser = await usersCollection.findOne({ email: newUser.email });
      if (existingUser) return res.send({ message: 'User already exists.' });

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Get all artworks (optional filter by email)
    app.get('/arts', async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {}; // filter if email provided
      const result = await artsCollection.find(query).toArray();
      res.send(result);
    });

    
    // Get single art by ID
    app.get('/arts/:id', async (req, res) => {
      const objectId = new ObjectId(req.params.id);
      const result = await artsCollection.findOne({ _id: objectId });
      res.send({ success: true, result });
    });

    // Add new art
    app.post('/arts', async (req, res) => {
      const result = await artsCollection.insertOne(req.body);
      res.send({ success: true, result });
    });

    // Update art
    app.put('/arts/:id', async (req, res) => {
      const objectId = new ObjectId(req.params.id);
      const filter = { _id: objectId };
      const update = { $set: req.body };
      const result = await artsCollection.updateOne(filter, update);
      res.send({ success: true, result });
    });

    // Patch art
    app.patch('/arts/:id', async (req, res) => {
      const objectId = new ObjectId(req.params.id);
      const update = { $set: req.body };
      const result = await artsCollection.updateOne({ _id: objectId }, update);
      res.send(result);
    });

    // Delete art
    app.delete('/arts/:id', async (req, res) => {
      const objectId = new ObjectId(req.params.id);
      const result = await artsCollection.deleteOne({ _id: objectId });
      res.send(result);
    });

    // ------------------------------------------------

  } finally {
    // do not close client; server will keep running
  }
}

// Start server **after connecting to MongoDB**
run().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
  });
}).catch(console.dir);
