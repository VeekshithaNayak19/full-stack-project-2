
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "students.json");

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Read student records
function readStudents() {
    try {
        const content = fs.readFileSync(DATA_FILE, "utf8");
        const students = JSON.parse(content);

        if (!Array.isArray(students)) {
            throw new Error("Student data must be an array");
        }

        return students;
    } catch (error) {
        if (error.code === "ENOENT") {
            fs.writeFileSync(DATA_FILE, "[]", "utf8");
            return [];
        }

        throw error;
    }
}

// Save student records
function saveStudents(students) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(students, null, 2),
        "utf8"
    );
}

// Validate student details
function validateStudent(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Please provide student details";
    }

    const { fullName, email, phone, age, course, address } = body;

    if (
        typeof fullName !== "string" ||
        typeof email !== "string" ||
        typeof phone !== "string" ||
        typeof course !== "string" ||
        typeof address !== "string" ||
        age === undefined ||
        age === null ||
        String(age).trim() === ""
    ) {
        return "Please provide all student details";
    }

    if (fullName.trim().length < 2) {
        return "Full name must contain at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return "Please enter a valid email address";
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
        return "Phone number must contain exactly 10 digits";
    }

    const studentAge = Number(age);

    if (
        !Number.isInteger(studentAge) ||
        studentAge < 1 ||
        studentAge > 120
    ) {
        return "Age must be a whole number between 1 and 120";
    }

    if (!course.trim() || !address.trim()) {
        return "Course and address cannot be empty";
    }

    return null;
}

// Standardize student details
function prepareStudent(body, id) {
    return {
        id,
        fullName: body.fullName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        age: Number(body.age),
        course: body.course.trim(),
        address: body.address.trim()
    };
}

// Home API
app.get("/api", (req, res) => {
    res.status(200).json({
        message: "Student Information API is running"
    });
});

// GET: Dashboard statistics
app.get("/api/dashboard", (req, res) => {
    try {
        const students = readStudents();
        const courseCounts = {};

        students.forEach(student => {
            const course = String(student.course || "Not specified").trim();
            courseCounts[course] = (courseCounts[course] || 0) + 1;
        });

        res.status(200).json({
            message: "Dashboard loaded successfully",
            totalStudents: students.length,
            courseCounts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to load dashboard"
        });
    }
});

// GET: View all students
app.get("/api/students", (req, res) => {
    try {
        const students = readStudents();

        res.status(200).json({
            message: "Students retrieved successfully",
            total: students.length,
            data: students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to read student records"
        });
    }
});

// GET: Search students by name, email, or exact ID
// This route must be before /api/students/:id
app.get("/api/students/search", (req, res) => {
    const query = req.query.q;

    if (typeof query !== "string" || !query.trim()) {
        return res.status(400).json({
            error: "Enter a student name, email, or ID"
        });
    }

    try {
        const students = readStudents();
        const searchText = query.trim().toLowerCase();

        const results = students.filter(student => {
            const name = String(student.fullName || "").toLowerCase();
            const email = String(student.email || "").toLowerCase();
            const id = String(student.id);

            return (
                name.includes(searchText) ||
                email.includes(searchText) ||
                id === searchText
            );
        });

        if (results.length === 0) {
            return res.status(404).json({
                message: "No matching student found",
                total: 0,
                data: []
            });
        }

        res.status(200).json({
            message: "Search completed successfully",
            total: results.length,
            data: results
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to search student records"
        });
    }
});

// POST: Add a student
app.post("/api/students", (req, res) => {
    const validationError = validateStudent(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const students = readStudents();
        const email = req.body.email.trim().toLowerCase();

        const duplicate = students.some(student =>
            String(student.email || "").toLowerCase() === email
        );

        if (duplicate) {
            return res.status(409).json({
                error: "A student with this email already exists"
            });
        }

        const nextId = students.length
            ? Math.max(...students.map(student => Number(student.id) || 0)) + 1
            : 1;

        const newStudent = prepareStudent(req.body, nextId);

        students.push(newStudent);
        saveStudents(students);

        res.status(201).json({
            message: "Student registered successfully",
            data: newStudent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to save student information"
        });
    }
});

// GET: Find one student by ID
app.get("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Student ID must be a positive integer"
        });
    }

    try {
        const students = readStudents();
        const student = students.find(item => Number(item.id) === id);

        if (!student) {
            return res.status(404).json({
                error: "Student not found"
            });
        }

        res.status(200).json({
            message: "Student found successfully",
            data: student
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to read student records"
        });
    }
});

// PUT: Update a student's details
app.put("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Student ID must be a positive integer"
        });
    }

    const validationError = validateStudent(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const students = readStudents();
        const index = students.findIndex(item => Number(item.id) === id);

        if (index === -1) {
            return res.status(404).json({
                error: "Student not found"
            });
        }

        const email = req.body.email.trim().toLowerCase();

        const duplicate = students.some(student =>
            Number(student.id) !== id &&
            String(student.email || "").toLowerCase() === email
        );

        if (duplicate) {
            return res.status(409).json({
                error: "Another student already uses this email"
            });
        }

        const updatedStudent = prepareStudent(req.body, id);
        students[index] = updatedStudent;
        saveStudents(students);

        res.status(200).json({
            message: "Student updated successfully",
            data: updatedStudent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to update student information"
        });
    }
});

// DELETE: Delete a student by ID
app.delete("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Student ID must be a positive integer"
        });
    }

    try {
        const students = readStudents();
        const index = students.findIndex(item => Number(item.id) === id);

        if (index === -1) {
            return res.status(404).json({
                error: "Student not found"
            });
        }

        const deletedStudent = students[index];
        students.splice(index, 1);
        saveStudents(students);

        res.status(200).json({
            message: "Student deleted successfully",
            data: deletedStudent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to delete student"
        });
    }
});

// Handle invalid JSON
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            error: "Invalid JSON format"
        });
    }

    console.error(error);
    res.status(500).json({
        error: "Internal server error"
    });
});

// Handle unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API route not found"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
