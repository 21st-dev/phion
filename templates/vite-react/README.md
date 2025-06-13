# 🚀 Your Website Project

Welcome to your new website! Everything is set up and ready to go. You can start editing right away.

## ✨ What You Can Do

This project includes everything you need to build a modern website:

- **Easy editing** - Change text, colors, and layout
- **Live preview** - See changes instantly as you type
- **Beautiful components** - Pre-built buttons, cards, and more
- **Auto-sync** - Your changes save automatically to the cloud
- **Live website** - Share your site with anyone, anywhere

## 🚀 Quick Start

> 🆕 **First time?** See [SETUP.md](./SETUP.md) for complete setup instructions.

### 1. Install Everything

```bash
pnpm install
```

### 2. Start Building

```bash
pnpm start
```

This will:

- Set up everything you need automatically
- Start your website at `http://localhost:5173`
- Sync your changes to the cloud
- Set up browser integration in Cursor

### 3. Start Creating!

- Edit files in the `src/` folder
- See changes instantly in your browser
- Your live website updates automatically
- Use the toolbar in the bottom-right to save changes

## 📱 Opening Your Website

**To see your website in Cursor:**

```bash
pnpm start
```

**To control your project:**

- Press `Cmd+Shift+P` in Cursor
- Type "Start Project" to run `pnpm start`
- Type "Open Preview" to see your website

**Additional commands:**

```bash
pnpm run clear:ports  # Clear any stuck processes
```

## 📁 Project Structure

```
src/
├── components/
│   └── ui/           # Pre-built components (buttons, cards, etc.)
├── App.tsx           # Your main website page
└── index.css         # Colors and styling
```

## 🎨 Building Your Website

### Using Pre-Built Components

You have access to beautiful, ready-to-use components:

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MyPage = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to My Site</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => alert("Hello!")}>Click me</Button>
      </CardContent>
    </Card>
  );
};
```

### Adding Icons

```typescript
import { Heart, Star, User } from "lucide-react";

const IconExample = () => {
  return (
    <div className="flex space-x-4">
      <Heart className="h-6 w-6 text-red-500" />
      <Star className="h-6 w-6 text-yellow-500" />
      <User className="h-6 w-6 text-blue-500" />
    </div>
  );
};
```

### Styling Your Website

Use simple class names to style your content:

```typescript
const MyComponent = () => {
  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Beautiful Design
      </h2>
      <p className="text-gray-600">Easy to make beautiful websites.</p>
    </div>
  );
};
```

## 🛠 Available Commands

- `pnpm start` - 🚀 Start everything (recommended)
- `pnpm setup:browser` - 📦 Set up browser integration (one-time)
- `pnpm clear:ports` - 🔧 Fix any connection issues
- `pnpm build` - 📦 Build your website for sharing
- `pnpm dev` - Start only the local preview
- `pnpm sync` - Start only the cloud sync

## ⚙️ Configuration Options

You can customize your development experience in `vybcel.config.json`:

```json
{
  "autoStartOnNewProject": true, // Auto-start when opening new projects
  "autoOptimizeWorkspace": true, // Auto-optimize Cursor workspace
  "debug": false, // Enable debug logging
  "toolbar": {
    "enabled": true, // Show development toolbar
    "position": "top", // Toolbar position
    "autoOpen": true // Auto-open toolbar
  }
}
```

### 🎯 Workspace Optimization

When `autoOptimizeWorkspace` is enabled (default), the extension will automatically:

- **Close the file explorer** - Focus on your code
- **Hide the terminal** - Clean workspace
- **Open AI chat** - Ready for assistance

This creates the perfect focused development environment. You can disable this by setting `"autoOptimizeWorkspace": false` in your config.

## 🌐 Your Live Website

Your project automatically creates a live website that you can share:

- **Live Preview** - See your changes at your project's live URL
- **Auto-Update** - Every save creates a new version
- **Share Easily** - Send the link to anyone

## 💡 Tips for Beginners

### 1. Start Simple

- Edit `src/App.tsx` to change your main page
- Change text, colors, and layout
- Add new components one at a time

### 2. Use AI Help in Cursor

**🎯 Quick Start: Press `Cmd+I` to open AI chat**

For the best development experience:

**💡 Planning Features:**

- Open a new tab in Cursor
- Switch to **Ask mode** with **OpenAI O3** model
- Ask for a feature plan with todo list
- Get detailed implementation steps

**🚀 Writing Code:**

- In the same chat, switch to **Agent mode** with **Claude** model
- Start implementing the planned features
- Let the agent write and edit code for you

**Example workflow:**

```
1. New Tab → Ask + OpenAI O3: "Plan a user login system with todo list"
2. Same Tab → Agent + Claude: "Implement the login form component"
3. Let the agent write the code automatically
```

**Quick AI shortcuts:**

- `Cmd+I` - Open AI chat
- `Cmd+K` - Inline code suggestions
- `Cmd+L` - Chat with your code

### 3. Save Often

- Your changes save automatically
- Use the toolbar to commit important changes
- Check your live website frequently

## 🆘 Getting Help

- **How to start?** - Press `Cmd+Shift+P` → "Start Project"
- **Can't see changes?** - Check that your website is running
- **Browser won't open?** - Press `Cmd+Shift+P` → "Open Preview"
- **Something broken?** - Try `pnpm run clear:ports` then restart
- **Need inspiration?** - Look at components in `src/components/ui/`
- **First time setup?** - See [SETUP.md](./SETUP.md) for detailed instructions

## 🚀 Ready to Build?

Your website is ready! Start by editing `src/App.tsx` and watch your changes come to life.

Happy building! 🎉
