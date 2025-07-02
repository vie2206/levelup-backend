// 🚀 LEVEL UP Production Backend with Real Google OAuth
// Deploy this to Render Web Service - SECURE VERSION

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({
  origin: ['https://app.legalight.org.in', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'levelup-session-fallback',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

// 🔐 ENVIRONMENT VARIABLES (Set these in Render Dashboard - NO SECRETS IN CODE!)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.legalight.org.in';

// Validate required environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

// 💾 In-memory storage (upgrade to MongoDB later)
let users = [];
let mockTests = [];

// 🔐 Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    let user = users.find(u => u.googleId === profile.id);
    
    if (!user) {
      // Create new user
      user = {
        id: Date.now().toString(),
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        avatar: profile.photos[0].value,
        role: 'student',
        mockTests: [],
        totalTests: 0,
        averageScore: 0,
        bestScore: 0,
        joinedDate: new Date(),
        lastLogin: new Date()
      };
      users.push(user);
      console.log(`✅ New user registered: ${user.name} (${user.email})`);
    } else {
      // Update last login
      user.lastLogin = new Date();
      console.log(`✅ User logged in: ${user.name} (${user.email})`);
    }
    
    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// 🏠 Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'LEVEL UP Backend API Running',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Real Google OAuth',
      'JWT Authentication', 
      'Mock Test Analytics',
      'Leaderboard System',
      'User Progress Tracking'
    ],
    stats: {
      totalUsers: users.length,
      totalTests: mockTests.length,
      uptime: process.uptime()
    }
  });
});

// 🔐 AUTHENTICATION ROUTES

// Google OAuth - Start
app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth - Callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}?error=auth_failed` }),
  (req, res) => {
    // Create JWT token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        email: req.user.email, 
        role: req.user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      totalTests: req.user.totalTests,
      averageScore: req.user.averageScore
    }))}`);
  }
);

// Logout
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// 🔒 JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// 📊 USER ROUTES

// Get current user
app.get('/api/user', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { googleId, ...userWithoutGoogleId } = user;
  res.json(userWithoutGoogleId);
});

// Get user by email (for compatibility)
app.get('/api/user/:email', (req, res) => {
  const user = users.find(u => u.email === req.params.email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { googleId, ...userWithoutGoogleId } = user;
  res.json(userWithoutGoogleId);
});

// 📝 MOCK TEST ROUTES

// Submit mock test
app.post('/api/mock-test', authenticateToken, (req, res) => {
  try {
    const { testName, score, attempted, correct, incorrect } = req.body;
    
    // Validate input
    if (!testName || score === undefined) {
      return res.status(400).json({ error: 'Test name and score are required' });
    }
    
    // Find user
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create new test entry
    const newTest = {
      id: Date.now().toString(),
      testName,
      score: parseInt(score),
      attempted: parseInt(attempted) || 120,
      correct: parseInt(correct) || 0,
      incorrect: parseInt(incorrect) || 0,
      date: new Date(),
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0
    };
    
    // Add to user's history
    user.mockTests.push(newTest);
    user.totalTests += 1;
    
    // Calculate new average score
    const totalScore = user.mockTests.reduce((sum, test) => sum + test.score, 0);
    user.averageScore = Math.round(totalScore / user.totalTests);
    
    // Update best score
    user.bestScore = Math.max(user.bestScore, newTest.score);
    
    // Add to global analytics
    mockTests.push({
      ...newTest,
      userId: user.id,
      userEmail: user.email,
      userName: user.name
    });
    
    console.log(`📝 Mock test submitted: ${user.name} - ${testName} - Score: ${score}`);
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        totalTests: user.totalTests,
        averageScore: user.averageScore,
        bestScore: user.bestScore
      },
      test: newTest,
      message: 'Mock test saved successfully!'
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Failed to save test' });
  }
});

// 📈 ANALYTICS ROUTES

// Get user analytics
app.get('/api/analytics/:email', (req, res) => {
  try {
    const user = users.find(u => u.email === req.params.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const analytics = {
      totalTests: user.totalTests,
      averageScore: user.averageScore,
      bestScore: user.bestScore,
      recentTests: user.mockTests.slice(-5).reverse(),
      improvement: calculateImprovement(user.mockTests),
      consistency: calculateConsistency(user.mockTests),
      weeklyProgress: calculateWeeklyProgress(user.mockTests)
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get user analytics (authenticated)
app.get('/api/analytics', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const analytics = {
      totalTests: user.totalTests,
      averageScore: user.averageScore,
      bestScore: user.bestScore,
      recentTests: user.mockTests.slice(-5).reverse(),
      improvement: calculateImprovement(user.mockTests),
      consistency: calculateConsistency(user.mockTests),
      weeklyProgress: calculateWeeklyProgress(user.mockTests)
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// 🏆 LEADERBOARD ROUTES

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const leaderboard = users
      .filter(u => u.totalTests > 0)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 20)
      .map((user, index) => ({
        rank: index + 1,
        name: user.name,
        email: user.email,
        score: user.averageScore,
        tests: user.totalTests,
        bestScore: user.bestScore,
        lastActive: user.lastLogin
      }));
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// 👥 ADMIN ROUTES

// Get all students
app.get('/api/students', (req, res) => {
  try {
    const students = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      totalTests: user.totalTests,
      averageScore: user.averageScore,
      bestScore: user.bestScore,
      lastLogin: user.lastLogin,
      joinedDate: user.joinedDate
    }));
    
    res.json(students);
  } catch (error) {
    console.error('Students error:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

// Get platform statistics
app.get('/api/stats', (req, res) => {
  try {
    const activeUsers = users.filter(u => u.totalTests > 0);
    const totalTestsSubmitted = mockTests.length;
    const averagePlatformScore = activeUsers.length > 0 ? 
      Math.round(activeUsers.reduce((sum, u) => sum + u.averageScore, 0) / activeUsers.length) : 0;
    
    const stats = {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      totalTestsSubmitted,
      averagePlatformScore,
      topScore: users.length > 0 ? Math.max(...users.map(u => u.bestScore)) : 0,
      recentActivity: mockTests.slice(-10).reverse()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// HELPER FUNCTIONS
function calculateImprovement(tests) {
  if (tests.length < 2) return 0;
  
  const recent = tests.slice(-3);
  const earlier = tests.slice(0, Math.max(1, tests.length - 3));
  
  if (earlier.length === 0) return 0;
  
  const recentAvg = recent.reduce((sum, t) => sum + t.score, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, t) => sum + t.score, 0) / earlier.length;
  
  return Math.round(recentAvg - earlierAvg);
}

function calculateConsistency(tests) {
  if (tests.length < 3) return 'Insufficient Data';
  
  const scores = tests.map(t => t.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  
  if (standardDeviation < 5) return 'Very Consistent';
  if (standardDeviation < 10) return 'Consistent';
  if (standardDeviation < 15) return 'Moderately Consistent';
  return 'Needs Focus';
}

function calculateWeeklyProgress(tests) {
  if (tests.length < 2) return [];
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const recentTests = tests.filter(test => new Date(test.date) >= oneWeekAgo);
  
  return recentTests.map(test => ({
    date: test.date,
    score: test.score,
    testName: test.testName
  }));
}

// 🌐 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LEVEL UP Production Backend running on port ${PORT}`);
  console.log(`🔐 Real Google OAuth enabled`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`👥 Users: ${users.length} | 📝 Tests: ${mockTests.length}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
