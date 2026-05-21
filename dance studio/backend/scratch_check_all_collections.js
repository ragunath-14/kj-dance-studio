const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('🔍 Querying all collections in DB...');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections present:', collections.map(c => c.name));
    
    for (const coll of collections) {
      const name = coll.name;
      const count = await db.collection(name).countDocuments();
      console.log(`- Collection "${name}": ${count} documents`);
      if (count > 0) {
        const docs = await db.collection(name).find().limit(10).toArray();
        console.log(`  Sample docs for "${name}":`);
        console.log(JSON.stringify(docs, null, 2));
      }
    }
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
