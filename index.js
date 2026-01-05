const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceKey.json');

const app = express();
const port = process.env.PORT || 3000;

/* ---------------- FIREBASE ADMIN ---------------- */
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ---------------- ROOT ---------------- */
app.get('/', (req, res) => {
  res.send('Smart server is running');
});

/* ---------------- MONGODB ---------------- */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ilappos.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* ---------------- VERIFY TOKEN ---------------- */
const verifyToken = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).send({ message: 'Unauthorized' });

    const token = auth.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.decodedUser = decoded;
    next();
  } catch {
    res.status(401).send({ message: 'Unauthorized' });
  }
};

/* ---------------- MAIN ---------------- */
async function run() {
  await client.connect();
  console.log('Connected to MongoDB successfully!');

  const db = client.db('art_db');
  const arts = db.collection('arts');
  const users = db.collection('users');
  const favorites = db.collection('favorites');
  const artLikes = db.collection('artLikes');


  /* ---------- USERS ---------- */
  app.post('/users', async (req, res) => {
    const exists = await users.findOne({ email: req.body.email });
    if (exists) return res.send({ message: 'User already exists.' });
    res.send(await users.insertOne(req.body));
  });

  app.put('/users/:email', verifyToken, async (req, res) => {
    const result = await users.updateOne(
      { email: req.params.email },
      { $set: req.body },
      { upsert: true }
    );
    res.send(result);
  });

  /* ---------- ARTS ---------- */
  app.get('/arts', async (req, res) => {
    const { email, category, limit = 0, page = 1 } = req.query;
    const skip = (page - 1) * Number(limit);

    let query = {};
    if (email) query.email = email;
    else query.visibility = 'public';
    if (category && category !== 'all') query.category = category;

    const result = await arts.find(query).skip(skip).limit(Number(limit)).toArray();
    const total = await arts.countDocuments(query);

    res.send({ arts: result, total });
  });

  app.get('/arts/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id))
      return res.status(400).send({ message: 'Invalid ID' });

    res.send(await arts.findOne({ _id: new ObjectId(req.params.id) }));
  });

  app.post('/arts', async (req, res) => {
    res.send(await arts.insertOne(req.body));
  });

  app.put('/arts/:id', async (req, res) => {
    res.send(
      await arts.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      )
    );
  });

  app.delete('/arts/:id', async (req, res) => {
    res.send(await arts.deleteOne({ _id: new ObjectId(req.params.id) }));
  });



  /* ---------- FEATURED ---------- */
  app.get('/featured-arts', async (req, res) => {
    res.send(
      await arts.find({}).sort({ createdAt: -1 }).limit(8).toArray()
    );
  });

/* ---------- LIKES ---------- */

app.post('/arts/:id/like', async (req, res) => {
  const artId = req.params.id;
  const { email } = req.body;

  if (!ObjectId.isValid(artId)) return res.status(400).send({ message: 'Invalid art ID' });
  if (!email) return res.status(400).send({ message: 'Email required' });

  try {
    const alreadyLiked = await artLikes.findOne({ artId, userEmail: email });

    let liked;
    let updatedDoc;

    if (alreadyLiked) {
      await artLikes.deleteOne({ _id: alreadyLiked._id });
      updatedDoc = await arts.findOneAndUpdate(
        { _id: new ObjectId(artId) },
        { $inc: { likes: -1 } },
        { returnDocument: 'after' }
      );
      liked = false;
    } else {
      await artLikes.insertOne({ artId, userEmail: email, createdAt: new Date() });
      updatedDoc = await arts.findOneAndUpdate(
        { _id: new ObjectId(artId) },
        { $inc: { likes: 1 } },
        { returnDocument: 'after' }
      );
      liked = true;
    }
    const finalDoc = updatedDoc.value ? updatedDoc.value : updatedDoc;

    res.status(200).send({
      likes: finalDoc.likes || 0,
      liked,
    });
  } catch (err) {
    console.error("Like Error:", err);
    res.status(500).send({ message: 'Failed to toggle like' });
  }
});





  /* ---------- FAVORITES ---------- */
  app.post('/favorites/toggle', async (req, res) => {
    const { artId, email } = req.body;
    const exists = await favorites.findOne({ artId, added_by: email });

    if (exists) {
      await favorites.deleteOne({ _id: exists._id });
      return res.send({ status: 'removed' });
    }

    await favorites.insertOne({
      artId,
      added_by: email,
      createdAt: new Date(),
    });

    res.send({ status: 'added' });
  });

  app.get('/favorites/check', async (req, res) => {
    const { artId, email } = req.query;
    const fav = await favorites.findOne({ artId, added_by: email });
    res.send({ isFavorite: !!fav });
  });

  app.get('/my-favorites', async (req, res) => {
    const favs = await favorites.find({ added_by: req.query.email }).toArray();
    const ids = favs.map(f => new ObjectId(f.artId));
    res.send(await arts.find({ _id: { $in: ids } }).toArray());
  });

  /* ================= USER STATS ================= */
  app.get('/user-stats/:email', async (req, res) => {
    const email = req.params.email;

    try {
      // Total artworks
      const totalArts = await arts.countDocuments({ email });

      // Favorites
      const favoritesCount = await favorites.countDocuments({ added_by: email });

      // Likes 
      const likesAgg = await arts.aggregate([
        { $match: { email } },
        { $group: { _id: null, totalLikes: { $sum: "$likes" } } }
      ]).toArray();
      const likes = likesAgg[0]?.totalLikes || 0;

      res.send({
        totalArts,
        favorites: favoritesCount,
        likes
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Failed to get user stats" });
    }
  });



}

run()
  .then(() => {
    app.listen(port, () =>
      console.log(`✅ Server running on port ${port}`)
    );
  })
  .catch(console.error);
