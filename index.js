const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Import jwt here
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // Added ObjectId for MongoDB operations
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ej6qyrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const bookCollection = client.db('Book-vibe').collection('books');
    const upcomingCollection = client.db('Book-vibe').collection('upcoming');
    const cartCollection = client.db('Book-vibe').collection('carts');
    const reviewCollection = client.db('Book-vibe').collection('reviews');
    const userCollection = client.db('Book-vibe').collection('users');

    // JWT generation route
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Middleware to verify JWT
    const verifyToken = (req, res, next) => {
      const authorizationHeader = req.headers.authorization;
      if (!authorizationHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = authorizationHeader.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware to verify admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Route to get all users (Admin only)
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Route to check if user is admin
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const user = await userCollection.findOne({ email: email });
      res.send({ admin: user?.role === 'admin' });
    });

    // Route to add new user
    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Route to promote user to admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: 'admin' } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Route to delete a user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Route to get all books
    app.get('/books', async (req, res) => {
      const result = await bookCollection.find().toArray();
      res.send(result);
    });

    // Route to get upcoming books
    app.get('/upcoming', async (req, res) => {
      const result = await upcomingCollection.find().toArray();
      res.send(result);
    });

    // Route to get reviews
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // Route to add an item to the cart
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // Route to get user's cart items
    app.get('/carts', async (req, res) => {
      try {
        const email = req.query.email;
        const result = await cartCollection.find({ email: email }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Ensure the MongoDB client connects
    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB!');
  } finally {
    // Optionally close the client connection when needed
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Book Vibe is running');
});

app.listen(port, () => {
  console.log(`Book Vibe is running at http://localhost:${port}`);
});
