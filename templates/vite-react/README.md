# 🚀 Vybcel React Project

Welcome to your new Vybcel project! This template includes everything you need to build modern React applications with automatic cloud sync and deployment.

## ✨ What's Included

- **React 18** - Latest React with hooks and modern patterns
- **TypeScript** - Full type safety and better developer experience
- **Vite** - Lightning fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework for rapid styling
- **shadcn/ui** - Beautiful, accessible components built on Radix UI
- **Lucide Icons** - Beautiful SVG icon library
- **Live Sync** - Automatic synchronization with Vybcel cloud
- **Auto Deploy** - Every save triggers a deployment to your live preview

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Development

```bash
pnpm start
```

This command starts both:

- **Local dev server** at `http://localhost:5173` for instant preview
- **Sync service** that sends your changes to Vybcel cloud

### 3. Start Coding!

- Edit files in the `src/` directory
- See changes instantly in your local browser
- Watch your live site update automatically in 20-30 seconds

## 📁 Project Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components (Button, Card, etc.)
├── lib/
│   └── utils.ts      # Utility functions (cn for class merging)
├── App.tsx           # Main application component
├── main.tsx          # Application entry point
└── index.css         # Global styles with Tailwind
```

## 🎨 Building UI Components

### Using shadcn/ui Components

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MyComponent = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello World</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => alert("Hello!")}>Click me</Button>
      </CardContent>
    </Card>
  );
};
```

### Using Icons

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

### Styling with Tailwind CSS

```typescript
const StyledComponent = () => {
  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Beautiful Design
        </h2>
        <p className="text-gray-600 leading-relaxed">
          Tailwind makes it easy to build beautiful interfaces.
        </p>
      </div>
    </div>
  );
};
```

## 🛠 Available Scripts

- `pnpm start` - Start both dev server and sync service
- `pnpm dev` - Start only the local development server
- `pnpm sync` - Start only the file sync service
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run ESLint for code quality
- `pnpm type-check` - Check TypeScript types

## 📋 TypeScript Examples

### Component with Props

```typescript
interface UserCardProps {
  name: string;
  email: string;
  avatar?: string;
  onClick?: () => void;
}

const UserCard: React.FC<UserCardProps> = ({
  name,
  email,
  avatar,
  onClick,
}) => {
  return (
    <Card className="cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{email}</p>
      </CardContent>
    </Card>
  );
};
```

### Using Hooks

```typescript
const Counter = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    console.log(`Count changed to: ${count}`);
  }, [count]);

  return (
    <div className="text-center space-y-4">
      <p className="text-xl">Count: {count}</p>
      <Button onClick={increment} disabled={loading} size="lg">
        Increment
      </Button>
    </div>
  );
};
```

## 🎯 Best Practices

### 1. Component Structure

- Keep components small and focused
- Use TypeScript interfaces for props
- Export components as default exports
- Use descriptive names

### 2. Styling

- Use Tailwind CSS classes over custom CSS
- Use shadcn/ui components for consistency
- Follow responsive design patterns
- Use the `cn()` utility for conditional classes

### 3. State Management

- Use `useState` for component state
- Use `useCallback` for functions passed to children
- Use `useMemo` for expensive calculations
- Use `useEffect` with proper dependencies

### 4. File Organization

- One component per file
- Use the `@/` alias for imports from `src/`
- Group related components in folders
- Keep files focused and cohesive

## 🔗 Vybcel Platform

This project automatically syncs with your Vybcel dashboard:

- **Live Preview**: See your changes at your project's live URL
- **Version History**: Track all changes and deployments
- **Deployment Status**: Monitor build and deployment progress
- **Project Settings**: Manage your project configuration

## 🆘 Getting Help

- Check the [shadcn/ui documentation](https://ui.shadcn.com) for component usage
- Visit [Tailwind CSS docs](https://tailwindcss.com/docs) for styling help
- See [React documentation](https://react.dev) for React patterns
- Contact Vybcel support for platform-specific issues

## 🚀 Ready to Ship?

Your project is configured with modern best practices and ready for development. Start editing `src/App.tsx` and watch your changes come to life!

Happy coding! 🎉

## ⚠️ SPA Routing for Netlify/Vybcel

If you deploy to Netlify or Vybcel, make sure to include a `public/_redirects` file with the following content:

```
/*    /index.html   200
```

This ensures that all routes are handled by your React app (SPA) and you never get a 404 on page reload.
