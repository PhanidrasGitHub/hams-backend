const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const dbpath = path.join(__dirname, 'hams.db')



let db = null
const intializedbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running.....')
    })
  } catch (e) {
    console.log(`Error: ${e.message}`)
    process.exit(1)
  }
}
intializedbAndServer()
// API to register a new hospital
// POST /hospitals





app.post('/hospitals', async (req, res) => {
  const { name, location, admin_id } = req.body;

  try {
    const result = await db.run(
      `INSERT INTO hospitals (name, location, admin_id) VALUES (?, ?, ?)`,
      [name, location, admin_id]
    );
    res.status(201).json({
      message: 'Hospital created successfully',
      hospital_id: result.lastID,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// API to register a new department
// POST /departments
app.post('/departments', async (req, res) => {
  const { hospital_id, name } = req.body;

  if (!hospital_id || !name) {
    return res.status(400).json({ error: 'hospital_id and name are required' });
  }

  try {
    const result = await db.run(
      `
      INSERT INTO departments (hospital_id, name)
      VALUES (?, ?)
      `,
      [hospital_id, name]
    );
    res.status(201).json({
      message: 'Department created successfully',
      department_id: result.lastID,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// API to register a new user*************************************************************************
// POST /users
app.post('/users', async (req, res) => {
  const { name, email, password, role, dob, gender, unique_id } = req.body;

  // Basic role validation (can be skipped if DB constraint exists)
  const validRoles = ['admin', 'doctor', 'patient'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    await db.run(
      `
      INSERT INTO users (name, email, password, role, dob, gender, unique_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [name, email, password, role, dob, gender, unique_id]
    );
    res.status(201).json({ message: 'User registered successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.post('/doctor-profiles', async (req, res) => {
  const { doctor_id, qualifications, experience_years } = req.body;

  if (!doctor_id || !qualifications || !experience_years) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const doctor = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'doctor'`, [doctor_id]);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found or not registered as doctor' });
    }

    const result = await db.run(
      `
      INSERT INTO doctor_profiles (doctor_id, qualifications, experience_years)
      VALUES (?, ?, ?)
      `,
      [doctor_id, qualifications, experience_years]
    );

    res.status(201).json({
      message: 'Doctor profile created successfully',
      profile_id: result.lastID,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API to add specializations for a doctor
// POST /specializations*************************************************************************
app.post('/specializations', async (req, res) => {
  const { doctor_id, specialization } = req.body;

  if (!doctor_id || !specialization) {
    return res.status(400).json({ error: 'doctor_id and specialization are required' });
  }

  try {
    // Check if doctor_profile exists
    const profile = await db.get(`SELECT * FROM doctor_profiles WHERE id = ?`, [doctor_id]);
    if (!profile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const result = await db.run(
      `
      INSERT INTO specializations (doctor_id, specialization)
      VALUES (?, ?)
      `,
      [doctor_id, specialization]
    );

    res.status(201).json({
      message: 'Specialization added successfully',
      specialization_id: result.lastID,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API to add availability slots for a doctor
// POST /availability*************************************************************************

app.post('/availability', async (req, res) => {
  const { doctor_id, hospital_id, start_time, end_time, consultation_fee } = req.body;

  if (!doctor_id || !hospital_id || !start_time || !end_time || !consultation_fee) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Optional: Check for overlapping slots for same doctor
    const conflict = await db.get(
      `
      SELECT * FROM availability_slots
      WHERE doctor_id = ? AND (
        (start_time < ? AND end_time > ?) OR
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND end_time <= ?)
      )
      `,
      [doctor_id, end_time, end_time, start_time, start_time, start_time, end_time]
    );

    if (conflict) {
      return res.status(400).json({ error: 'Conflicting availability slot exists' });
    }

    const result = await db.run(
      `
      INSERT INTO availability_slots (doctor_id, hospital_id, start_time, end_time, consultation_fee)
      VALUES (?, ?, ?, ?, ?)
      `,
      [doctor_id, hospital_id, start_time, end_time, consultation_fee]
    );

    res.status(201).json({
      message: 'Availability slot added',
      slot_id: result.lastID,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// API to book an appointment
// POST /appointments*************************************************************************
app.post('/appointments', async (req, res) => {
  const { patient_id, doctor_id, hospital_id, slot_id, consultation_fee } = req.body;

  try {
    // 1. Check if slot already booked
    const isBooked = await db.get(`SELECT * FROM appointments WHERE slot_id = ?`, [slot_id]);
    if (isBooked) {
      return res.status(400).json({ error: 'This slot is already booked.' });
    }

    // 2. Insert new appointment
    const result = await db.run(
      `
      INSERT INTO appointments (patient_id, doctor_id, hospital_id, slot_id, consultation_fee)
      VALUES (?, ?, ?, ?, ?)
      `,
      [patient_id, doctor_id, hospital_id, slot_id, consultation_fee]
    );

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment_id: result.lastID
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// API to register a new patient
// POST /patients*************************************************************************
app.post('/patients', async (req, res) => {
  const { name, email, password, dob, gender, unique_id } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO users (name, email, password, role, dob, gender, unique_id)
       VALUES (?, ?, ?, 'patient', ?, ?, ?)`,
      [name, email, password, dob, gender, unique_id]
    );
    res.status(201).json({ message: 'Patient registered', patient_id: result.lastID });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// API to get all doctors with optional filters
// GET /doctors?specialization=cardiology&hospital_id=1................................................
app.get('/doctors', async (req, res) => {
  const { specialization, hospital_id } = req.query;
  try {
    let query = `SELECT u.id, u.name, d.qualifications, s.specialization
                 FROM users u
                 JOIN doctor_profiles d ON u.id = d.doctor_id
                 JOIN specializations s ON s.doctor_id = d.id
                 WHERE u.role = 'doctor'`;

    const conditions = [];
    const params = [];

    if (specialization) {
      conditions.push('s.specialization = ?');
      params.push(specialization);
    }
    if (hospital_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM availability_slots a
        WHERE a.doctor_id = u.id AND a.hospital_id = ?
      )`;
      params.push(hospital_id);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    const doctors = await db.all(query, params);
    res.json(doctors);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// API to get all hospitals with optional filters
// GET /hospitals?location=city1&specialization=cardiology................................................
app.get('/patients/:patientId/history', async (req, res) => {
  const { patientId } = req.params;

  try {
    const history = await db.all(
      `
      SELECT 
        a.id AS appointment_id,
        d.doctor_id,
        u.name AS doctor_name,
        h.name AS hospital_name,
        s.start_time,
        s.end_time,
        a.consultation_fee,
        a.booked_at
      FROM appointments a
      JOIN doctor_profiles d ON a.doctor_id = d.id
      JOIN users u ON d.doctor_id = u.id
      JOIN hospitals h ON a.hospital_id = h.id
      JOIN availability_slots s ON a.slot_id = s.id
      WHERE a.patient_id = ?
      ORDER BY a.booked_at DESC
      `,
      [patientId]
    );

    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// API to get all hospitals with optional filters
// GET /hospitals?location=city1&specialization=cardiology................................................

app.get('/doctors/:doctorId/dashboard', async (req, res) => {
  const { doctorId } = req.params;

  try {
    const stats = await db.get(
      `
      SELECT 
        COUNT(*) AS total_consultations,
        SUM(consultation_fee * 0.6) AS total_earnings
      FROM appointments
      WHERE doctor_id = ?
      `,
      [doctorId]
    );

    const perHospital = await db.all(
      `
      SELECT 
        h.name AS hospital_name,
        COUNT(*) AS consultations,
        SUM(consultation_fee * 0.6) AS earnings
      FROM appointments a
      JOIN hospitals h ON a.hospital_id = h.id
      WHERE a.doctor_id = ?
      GROUP BY h.id
      `,
      [doctorId]
    );

    res.json({ ...stats, breakdown_by_hospital: perHospital });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// API to get hospital dashboard
// GET /hospitals/:hospitalId/dashboard..................................................................
app.get('/hospitals/:hospitalId/dashboard', async (req, res) => {
  const { hospitalId } = req.params;

  try {
    const stats = await db.get(
      `
      SELECT 
        COUNT(*) AS total_consultations,
        SUM(consultation_fee * 0.4) AS hospital_earnings
      FROM appointments
      WHERE hospital_id = ?
      `,
      [hospitalId]
    );

    const perDoctor = await db.all(
      `
      SELECT 
        u.name AS doctor_name,
        COUNT(*) AS consultations,
        SUM(consultation_fee * 0.4) AS hospital_earnings_from_doctor
      FROM appointments a
      JOIN doctor_profiles d ON a.doctor_id = d.id
      JOIN users u ON d.doctor_id = u.id
      WHERE a.hospital_id = ?
      GROUP BY a.doctor_id
      `,
      [hospitalId]
    );

    const perDepartment = await db.all(
      `
      SELECT 
        dept.name AS department_name,
        COUNT(*) AS consultations,
        SUM(a.consultation_fee * 0.4) AS earnings
      FROM appointments a
      JOIN doctor_profiles d ON a.doctor_id = d.id
      JOIN specializations s ON d.id = s.doctor_id
      JOIN departments dept ON dept.name = s.specialization AND dept.hospital_id = a.hospital_id
      WHERE a.hospital_id = ?
      GROUP BY dept.name
      `,
      [hospitalId]
    );

    res.json({
      ...stats,
      earnings_by_doctor: perDoctor,
      earnings_by_department: perDepartment
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



