import Link from "next/link";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-100">
      <div className="max-w-md w-full px-4">
        <Material type="base" className="p-8 text-center">
          <div className="space-y-6 flex flex-col items-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-2xl">🚫</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-1000">
                Page not found
              </h1>
              <p className="text-gray-700">
                The page you are looking for doesn&apos;t exist.
              </p>
            </div>

            <Link href="/">
              <Button type="primary" size="medium">
                Go back home
              </Button>
            </Link>
          </div>
        </Material>
      </div>
    </div>
  );
}
