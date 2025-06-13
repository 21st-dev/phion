"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/geist/button";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectCount: number;
  maxProjects: number;
}

export function PricingModal({
  open,
  onOpenChange,
  currentProjectCount,
  maxProjects,
}: PricingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isYearly, setIsYearly] = useState(true); // Default to yearly
  const { error: showError, info } = useToast();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      console.log("🚀 Starting upgrade process...");

      // Get current user data - you might need to adjust this based on your auth system
      const response = await fetch("/api/user/me");
      const userData = await response.json();

      console.log("👤 User data retrieved:", userData);

      if (!userData?.email) {
        throw new Error("User email not found");
      }

      const paymentPayload = {
        email: userData.email,
        planId: "pro",
        period: isYearly ? "yearly" : "monthly",
        successUrl: `${window.location.origin}/project/1/success?upgraded=true`,
        cancelUrl: `${window.location.origin}/project/1?upgrade=cancelled`,
      };

      console.log("💳 Creating payment link with payload:", paymentPayload);

      // Use our internal API endpoint (proxies to 21st.dev with autoCreateUser)
      const paymentResponse = await fetch("/api/subscription/payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentPayload),
      });

      console.log("📡 Payment response status:", paymentResponse.status);

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error(
          "❌ Payment response not OK:",
          paymentResponse.status,
          errorText
        );
        throw new Error(`HTTP ${paymentResponse.status}: ${errorText}`);
      }

      const paymentData = await paymentResponse.json();

      console.log("📊 Payment API response:", {
        success: paymentData.success,
        hasActiveSubscription: paymentData.hasActiveSubscription,
        hasPaymentUrl: !!paymentData.paymentUrl,
        userCreated: paymentData.userCreated,
        error: paymentData.error,
        message: paymentData.message,
        details: paymentData.details,
      });

      if (paymentData.success && paymentData.paymentUrl) {
        // User created (if needed) and payment link ready
        console.log("🔗 Redirecting to payment URL");
        if (paymentData.userCreated) {
          console.log("✨ New user created in 21st.dev system");
        }

        // Show success message before redirect
        info(
          "Redirecting to payment",
          `Taking you to the payment page for ${
            isYearly ? "yearly" : "monthly"
          } plan...`
        );
        window.location.href = paymentData.paymentUrl;
      } else if (paymentData.hasActiveSubscription) {
        // User already has subscription
        console.log(
          "✅ User already has active subscription:",
          paymentData.currentPlan
        );
        info("Already subscribed", "You already have an active subscription!");
        onOpenChange(false);
      } else {
        // API returned success=false or no paymentUrl
        console.error("❌ Payment creation failed:", paymentData);

        let errorMessage = "Failed to create payment link";
        if (paymentData.error) {
          errorMessage = paymentData.error;
        } else if (paymentData.details?.error) {
          errorMessage = paymentData.details.error;
        } else if (paymentData.message) {
          errorMessage = paymentData.message;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("💥 Error in handleUpgrade:", error);

      // Show user-friendly error with more context
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (errorMessage.includes("API key")) {
        showError(
          "Configuration Error",
          "The payment system is temporarily unavailable. Please contact support."
        );
      } else if (errorMessage.includes("User not found")) {
        showError(
          "Account Setup Required",
          "Please try again or contact support if the issue persists."
        );
      } else if (
        errorMessage.includes("No such price") ||
        errorMessage.includes("StripeInvalidRequestError")
      ) {
        showError(
          "Payment Configuration Issue",
          "The pricing plans are being updated. Please try again in a few minutes or contact support."
        );
        console.log(
          "💡 Stripe price ID issue - likely needs updating on the payment server"
        );
      } else if (errorMessage.includes("Internal server error")) {
        showError(
          "Service Temporarily Unavailable",
          "Payment service is down. Please try again in a few minutes."
        );
      } else {
        showError(
          "Payment Error",
          `Failed to create payment link: ${errorMessage}`
        );
      }

      // Fallback to pricing page
      console.log("🔄 Falling back to pricing page");
      window.open("https://21st.dev/pricing", "_blank");
    } finally {
      setIsLoading(false);
    }
  };

  const monthlyPrice = 20;
  const yearlyPrice = 16; // $16/month when billed yearly

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold text-left">
            Upgrade Plan
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-left">
            You&apos;re currently on the Free plan.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          {/* Plan Card */}
          <div className="border rounded-lg p-5 mb-4 bg-background">
            <div className="font-medium mb-1">21st.dev & Vybcel Pro</div>
            <div className="text-2xl font-bold mb-2">
              ${isYearly ? yearlyPrice : monthlyPrice}{" "}
              <span className="text-base font-normal text-muted-foreground">
                /month{isYearly ? " billed yearly" : ""}
              </span>
            </div>
            <ul className="space-y-2 mb-2">
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Unlimited projects
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Access to 21st.dev Magic AI
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Custom domain support (coming soon)
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Priority support
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Advanced analytics
              </li>
            </ul>
            <div className="text-xs text-muted-foreground">
              Current projects: {currentProjectCount} / {maxProjects}
            </div>
          </div>

          {/* Compare plans */}
          <div className="text-xs mb-4">
            Compare plans and options on our{" "}
            <a
              href="https://21st.dev/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              pricing page
            </a>
            .
          </div>

          {/* Info box */}
          <div className="rounded bg-muted p-3 text-xs text-muted-foreground mb-4">
            Vybcel is part of the 21st.dev ecosystem. Your Vybcel subscription
            gives you access to all 21st.dev tools including{" "}
            <a
              href="https://21st.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Magic AI component generation
            </a>{" "}
            and premium features.
          </div>
        </div>

        {/* Footer with Billing Toggle and Action Buttons */}
        <div className="flex items-center justify-between px-6 pb-6">
          {/* Billing Toggle */}
          <div className="text-sm text-muted-foreground flex gap-2">
            <span
              onClick={() => setIsYearly(true)}
              className={`cursor-pointer ${
                isYearly ? "text-primary font-medium" : ""
              }`}
            >
              Yearly
            </span>
            <span
              onClick={() => setIsYearly(false)}
              className={`cursor-pointer ${
                !isYearly ? "text-primary font-medium" : ""
              }`}
            >
              Monthly
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="secondary"
              size="medium"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="medium"
              onClick={handleUpgrade}
              loading={isLoading}
            >
              {isLoading ? "Creating checkout..." : "Upgrade to Pro"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
