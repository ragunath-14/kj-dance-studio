const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Student = require('./models/Student');
const Payment = require('./models/Payment');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio';

const seedData = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing data (optional, but good for a fresh start)
        // await Student.deleteMany({});
        // await Payment.deleteMany({});

        const danceStyles = ['Hip Hop', 'Ballet', 'Contemporary', 'Bollywood', 'Salsa', 'Jazz'];
        const classTypes = ['Regular Class', 'Dance Class', 'Fitness Class'];

        const studentsToAdd = [];
        for (let i = 1; i <= 20; i++) {
            studentsToAdd.push({
                studentName: `Student ${i}`,
                email: `student${i}@example.com`,
                phone: `99887766${i.toString().padStart(2, '0')}`,
                danceStyle: danceStyles[Math.floor(Math.random() * danceStyles.length)],
                classType: classTypes[Math.floor(Math.random() * classTypes.length)],
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
            });
        }

        const createdStudents = await Student.insertMany(studentsToAdd);
        console.log(`Added ${createdStudents.length} students.`);

        const paymentsToAdd = [];
        // Add payments for half of the students
        for (let i = 0; i < 10; i++) {
            paymentsToAdd.push({
                studentId: createdStudents[i]._id,
                amount: 1500,
                date: new Date().toISOString(),
                method: 'Cash',
                purpose: 'Monthly Fee'
            });
        }

        await Payment.insertMany(paymentsToAdd);
        console.log(`Added ${paymentsToAdd.length} payments.`);

        console.log('Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedData();
