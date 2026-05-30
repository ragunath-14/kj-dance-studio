const mongoose = require('mongoose');
require('dotenv').config();

const studentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.model('Student', studentSchema);

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio');
    const bavi = await Student.findOne({ studentName: /bavi/i });
    console.log('Bavi record:', JSON.stringify(bavi, null, 2));
    process.exit(0);
}
check();
