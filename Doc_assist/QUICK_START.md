# Quick Start Guide

## 🚀 Get Your Documentation Assistant Running in 5 Minutes!

### Step 1: Install Dependencies (if not already done)

```powershell
npm install
```

### Step 2: Configure Environment

The `.env` file is already created with default settings for local development:

```env
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_ENABLE_CACHE=true
```

**For production**, update with your actual API URL:
```env
REACT_APP_API_BASE_URL=https://your-api-domain.com/api
```

### Step 3: Start the Frontend

```powershell
npm start
```

The app will open at `http://localhost:3000`

### Step 4: Test Without Backend (Fallback Mode)

The app now works even without a backend! Try it:

1. Open `http://localhost:3000`
2. Click on the Demo section
3. Select a programming language
4. Try the example code or paste your own
5. Click "Generate Documentation"

You'll see a message: **"Using offline mode. Connect to API for better results."**

This is the fallback mode - it still generates documentation using local logic!

### Step 5: Connect to Real Backend (Optional)

For AI-powered documentation, set up a backend:

#### Option A: Quick Test Server (Python/Flask)

1. Use the included backend server at `backend/server.py`.

2. Install backend requirements:
```powershell
pip install -r backend/requirements.txt
```

3. Run the server:
```powershell
python backend/server.py
```

4. Refresh your frontend - it will now connect to the backend!

#### Option B: Use Your Own AI Model

Follow the complete guide in `BACKEND_API_GUIDE.md` to integrate:
- CodeT5 from Hugging Face
- OpenAI GPT
- Your custom model

### Step 6: Verify Everything Works

Test the following features:

✅ **Basic Generation**
- Enter code in the demo
- Generate documentation
- Copy to clipboard

✅ **Language Support**
- Try Python, JavaScript, Java, C++, C#
- Each should use appropriate docstring format

✅ **Cache System**
- Generate docs for the same code twice
- Second time should show "Retrieved from cache!"

✅ **Error Handling**
- Stop the backend server
- Try generating docs
- Should gracefully fall back to offline mode

✅ **Metadata Display**
- Check confidence score
- View processing time
- See complexity analysis

## 🎯 What You Have Now

### Frontend Features
- ✅ Interactive demo with live code editing
- ✅ Multiple programming language support
- ✅ Syntax highlighting
- ✅ Copy to clipboard
- ✅ Real-time validation
- ✅ Loading states and animations
- ✅ Error handling with user feedback
- ✅ Responsive design

### Backend Integration
- ✅ HTTP client with retry logic
- ✅ Automatic caching (1-hour TTL)
- ✅ Timeout handling (30 seconds)
- ✅ Fallback mode when API unavailable
- ✅ Code complexity analysis
- ✅ Input validation
- ✅ Security measures (XSS prevention)

### Utilities
- ✅ 50+ utility functions
- ✅ Code parsing and analysis
- ✅ Type inference
- ✅ Syntax validation
- ✅ Performance optimization

## 📊 Testing the Features

### Test 1: Basic Documentation Generation
```javascript
// Paste this in the demo (JavaScript mode):
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```
Expected: JSDoc format documentation

### Test 2: Python with Type Hints
```python
# Paste this in the demo (Python mode):
def process_data(data: list, threshold: int = 10) -> dict:
    filtered = [x for x in data if x > threshold]
    return {"count": len(filtered), "values": filtered}
```
Expected: Google-style docstring with Args and Returns

### Test 3: Complex Code
```java
// Paste this in the demo (Java mode):
public class BinaryTree {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}
```
Expected: JavaDoc format with complexity analysis

## 🔧 Troubleshooting

### Frontend won't start
```powershell
# Clear cache and reinstall
rm -r node_modules
rm package-lock.json
npm install
npm start
```

### API connection failed
- Check `.env` has correct `REACT_APP_API_BASE_URL`
- Verify backend server is running on correct port
- Check browser console for CORS errors
- Ensure backend has CORS enabled

### Cache not working
- Check `.env` has `REACT_APP_ENABLE_CACHE=true`
- Clear browser cache
- Check console for cache-related messages

### Documentation looks wrong
- Verify correct language is selected
- Check if backend is running (for AI docs)
- Try fallback mode by stopping backend

## 🎨 Customization

### Change API Timeout
In `.env`:
```env
REACT_APP_API_TIMEOUT=60000  # 60 seconds
```

### Disable Caching
In `.env`:
```env
REACT_APP_ENABLE_CACHE=false
```

### Change Retry Attempts
In `src/utils/constants.js`:
```javascript
export const API_CONFIG = {
  RETRY_ATTEMPTS: 5,  // Change from 3 to 5
  // ...
};
```

## 📚 Learn More

- **Full utilities documentation**: `src/utils/README.md`
- **Backend setup guide**: `BACKEND_API_GUIDE.md`
- **Implementation details**: `IMPLEMENTATION_SUMMARY.md`
- **Main README**: `README.md`

## 🎉 You're All Set!

Your Code Documentation Assistant is now fully functional with:
- ✅ Working frontend
- ✅ API integration ready
- ✅ Fallback mode for offline use
- ✅ Production-ready utilities
- ✅ Comprehensive error handling

**Next Steps:**
1. Customize the styling to match your brand
2. Add your AI model to the backend
3. Deploy to production
4. Share with your team!

Happy documenting! 🚀
