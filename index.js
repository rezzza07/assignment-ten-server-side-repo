const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://rezadbUser:ECBpEaY2PB.9yN4@cluster0.ilappos.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// ROUTES
app.get('/', (req, res) => {
    res.send('Server is running');
})


app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})