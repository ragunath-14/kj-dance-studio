const mongoose = require('mongoose');


// Extra classes a student takes alongside the primary one (classType / feePlan / batchTiming above)
const ExtraClassSchema = new mongoose.Schema({
  classType: {
    type: String,
    required: true,
    enum: ['Regular Class', 'Fitness Class', 'Online Class', 'Karate Class', 'Zumba Class', 'Silambam Class', 'Art & Craft Class']
  },
  feePlan:     { type: String, enum: ['', '5 Class', '3 Class'], trim: true },
  batchTiming: { type: String, trim: true }
}, { _id: false });

// Offer history set by the admin. Each entry starts at a billing cycle (0 = joining month) and gives
// percent% off plus a flat amount off every monthly bill from that cycle on.
const DiscountSchema = new mongoose.Schema({
  fromCycle: { type: Number, required: true, min: 0 },
  percent:   { type: Number, default: 0, min: 0, max: 100 },
  amount:    { type: Number, default: 0, min: 0 },
  setAt:     { type: Date, default: Date.now }
}, { _id: false });

// A referral code that has been replaced by a newer one
const ReferralCodeHistorySchema = new mongoose.Schema({
  code:      { type: String, trim: true, uppercase: true, required: true },
  createdAt: { type: Date },
  expiredAt: { type: Date, default: Date.now },
  expiredBy: { type: String, enum: ['student', 'admin'], default: 'student' }
}, { _id: false });

// One reward per accepted referral: percent% off the bill of billing cycle `cycle` (0 = joining month)
const ReferralRewardSchema = new mongoose.Schema({
  refereeStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  refereeName:      { type: String, trim: true },
  percent:          { type: Number, required: true, min: 0, max: 100 },
  cycle:            { type: Number, required: true, min: 0 },
  grantedAt:        { type: Date, default: Date.now }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\d\s+\-()]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number (at least 10 digits)'
    },
    index: true
  },
  whatsappNumber: { type: String, trim: true },
  danceStyle: { type: String, trim: true },
  danceForFitness: { type: String, trim: true },
  feePlan: { type: String, enum: ['', '5 Class', '3 Class'], trim: true }, // Zumba plan
  extraClasses: { type: [ExtraClassSchema], default: [] },
  discounts: { type: [DiscountSchema], default: [] },

  // Referral programme: this student's own code, and the rewards earned when people they referred were accepted
  referralCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  referralCodeCreatedAt: { type: Date },
  // Codes that were replaced ("regenerated"). They no longer work for new sign-ups; they are kept so a friend who
  // registered while the code was still valid is still rewarded, and so the admin can see the history.
  referralCodeHistory: { type: [ReferralCodeHistorySchema], default: [] },
  referralRewards: { type: [ReferralRewardSchema], default: [] },
  classType: {
    type: String,
    enum: {
      values: ['Dance Class', 'Fitness Class', 'Regular Class', 'Online Class', 'Karate Class', 'Zumba Class', 'Silambam Class', 'Art & Craft Class'],
      message: '{VALUE} is not a valid class type'
    },
    default: 'Dance Class'
  },
  studentAge: { type: String, trim: true },
  studentCategory: {
    type: String,
    enum: { values: ['Kids', 'Adults'], message: '{VALUE} is not a valid category' },
    default: 'Adults'
  },
  gender: { type: String, enum: { values: ['Male', 'Female', 'Other', ''], message: '{VALUE} is not a valid gender' }, trim: true },
  bloodGroup: { type: String, trim: true },
  parentName: { type: String, trim: true },
  emergencyContactName: { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
  location: { type: String, trim: true },
  address: { type: String, trim: true },
  batchTiming: { type: String, trim: true },
  classSchedule: {
    type: String,
    enum: { values: ['Weekday', 'Weekend', 'NA'], message: '{VALUE} is not a valid class schedule' },
    default: 'NA'
  },
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  lastAlertSent: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

StudentSchema.index({ 'referralCodeHistory.code': 1 });

// Explicitly use 'students' collection to share data with registration backend
module.exports = mongoose.model('Student', StudentSchema, 'students');
