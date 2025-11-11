const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ilappos.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('Smart server is running');
})

async function run() {
    try {
        await client.connect();

        const db = client.db('art_db');
        const artsCollection = db.collection('arts');
        const usersCollection = db.collection('users');

        app.post('/users', async (req, res) => {
            const newUser = req.body;

            const email = req.body.email;
            const query = { email: email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'user already exists.' })
            }
            else {
                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            }

        })


        app.get('/arts', async (req, res) => {
            // const projectFields = {title:1}
            // const cursor =artsCollection.find().sort({}).skip(2).limit(6).project(projectFields);

            console.log(req.query)
            const userEmail = req.query.userEmail;
            const query = {}
            if (userEmail) {
                query.userEmail = userEmail;
            }
            const cursor = artsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/arts/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) }
            const result = await artsCollection.findOne(query);
            res.send(result);
        })

        app.post('/arts', async (req, res) => {
            const newArt = req.body;
            const result = await artsCollection.insertOne(newArt);
            res.send(result);
        })

        app.patch('/arts/:id', async (req, res) => {

            const id = req.params.id;
            const updatedArt = req.body;
            const query = { _id: new ObjectId(id) }
            const update = { $set: updatedArt }
            const result = await artsCollection.updateOne(query, update)
            res.send(result);
        })

        app.delete('/arts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await artsCollection.deleteOne(query);
            res.send(result);
        })




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }

}

run().catch(console.dir);


app.listen(port, () => {
    console.log(`Smart server is running on port: ${port}`);
})