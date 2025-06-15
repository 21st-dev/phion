import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(
      "🚀 Creating payment link for:",
      body.email,
      "Plan:",
      body.planId,
      "Period:",
      body.period,
    );

    const hasApiKey = !!process.env.SUBSCRIPTION_API_KEY;
    const isDevelopment = process.env.NODE_ENV === "development";

    console.log("🔑 API Key present:", hasApiKey);
    console.log("🛠️ Development mode:", isDevelopment);
    console.log("🛠️ NODE_ENV:", process.env.NODE_ENV);

    // Development fallback when API key is missing
    if (!hasApiKey && isDevelopment) {
      console.log(
        "⚠️ Development mode: API key missing, returning mock payment URL",
      );

      const mockResponse = {
        success: true,
        hasActiveSubscription: false,
        paymentUrl:
          "https://checkout.stripe.com/c/pay/mock-session-for-dev-testing",
        sessionId: "cs_dev_mock_session_id",
        planId: body.planId || "pro",
        period: body.period || "yearly",
        userId: "dev_user_123",
        email: body.email,
        userCreated: true,
        message: "Development mode - mock payment URL",
      };

      return NextResponse.json(mockResponse);
    }

    // Prepare payload without apiKey (send in header instead)
    const payload = {
      email: body.email,
      planId: body.planId || "pro",
      period: body.period || "yearly",
      autoCreateUser: true,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    };

    console.log("📤 Sending payload:", payload);
    console.log("🔐 Sending API key in Authorization header");

    // Proxy request to local 21st.dev API server for testing
    const response = await fetch(
      "https://21st.dev/api/subscription/payment-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUBSCRIPTION_API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();

    console.log("📊 21st.dev API Response:", {
      success: data.success,
      hasActiveSubscription: data.hasActiveSubscription,
      paymentUrl: data.paymentUrl ? "✅ Present" : "❌ Missing",
      sessionId: data.sessionId ? "✅ Present" : "❌ Missing",
      userId: data.userId,
      email: data.email,
      planId: data.planId,
      period: data.period,
      userCreated: data.userCreated,
      message: data.message,
      error: data.error,
    });

    if (!response.ok) {
      console.error("❌ 21st.dev API Error:", response.status, data);

      // Demo mode fallback for Stripe configuration issues
      if (isDevelopment && data.error?.includes?.("No such price")) {
        console.log(
          "🎭 Demo mode: Stripe price issue, returning demo payment URL",
        );
        return NextResponse.json({
          success: true,
          hasActiveSubscription: false,
          paymentUrl:
            "https://checkout.stripe.com/c/pay/demo-payment-url-replace-with-real",
          sessionId: "cs_demo_session_id",
          planId: body.planId || "pro",
          period: body.period || "yearly",
          userId: "demo_user_123",
          email: body.email,
          userCreated: false,
          message: "Demo mode - Stripe price configuration needs updating",
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: "Payment service unavailable",
          details: data,
        },
        { status: response.status },
      );
    }

    // Return the response from 21st.dev
    return NextResponse.json(data);
  } catch (error) {
    console.error("💥 Payment link creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create payment link",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Debug endpoint to check environment variables
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // If debug parameter is set, return environment info
  if (searchParams.get("debug") === "true") {
    return NextResponse.json({
      NODE_ENV: process.env.NODE_ENV,
      hasApiKey: !!process.env.SUBSCRIPTION_API_KEY,
      apiKeyLength: process.env.SUBSCRIPTION_API_KEY?.length || 0,
      isDevelopment: process.env.NODE_ENV === "development",
      timestamp: new Date().toISOString(),
    });
  }

  // Regular GET functionality for payment links
  const email = searchParams.get("email");
  const planId = searchParams.get("planId") || "pro";
  const period = searchParams.get("period") || "yearly";
  const successUrl = searchParams.get("successUrl");
  const cancelUrl = searchParams.get("cancelUrl");

  const hasApiKey = !!process.env.SUBSCRIPTION_API_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";

  console.log("🔑 API Key present (GET):", hasApiKey);

  if (!email || !successUrl || !cancelUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required parameters: email, successUrl, cancelUrl",
      },
      { status: 400 },
    );
  }

  // Development fallback when API key is missing
  if (!hasApiKey && isDevelopment) {
    console.log(
      "⚠️ Development mode (GET): API key missing, returning mock payment URL",
    );

    const mockResponse = {
      success: true,
      hasActiveSubscription: false,
      paymentUrl:
        "https://checkout.stripe.com/c/pay/mock-session-for-dev-testing",
      sessionId: "cs_dev_mock_session_id",
      planId,
      period,
      userId: "dev_user_123",
      email,
      userCreated: true,
      message: "Development mode - mock payment URL",
    };

    return NextResponse.json(mockResponse);
  }

  console.log(
    "🚀 Creating payment link via GET for:",
    email,
    "Plan:",
    planId,
    "Period:",
    period,
  );

  try {
    const payload = {
      email,
      planId,
      period,
      autoCreateUser: true,
      successUrl,
      cancelUrl,
    };

    const response = await fetch(
      "https://21st.dev/api/subscription/payment-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUBSCRIPTION_API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();

    console.log("📊 21st.dev API Response (GET):", {
      success: data.success,
      hasActiveSubscription: data.hasActiveSubscription,
      paymentUrl: data.paymentUrl ? "✅ Present" : "❌ Missing",
      sessionId: data.sessionId ? "✅ Present" : "❌ Missing",
      userId: data.userId,
      email: data.email,
      userCreated: data.userCreated,
      message: data.message,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("💥 Payment link creation error (GET):", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create payment link",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
