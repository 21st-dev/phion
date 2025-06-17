interface ApprovalEmailProps {
  name: string
  discordInvite?: string
}

export const ApprovalEmail = ({
  name,
  discordInvite = "https://discord.gg/j4ZMYnMeJN",
}: ApprovalEmailProps) => {
  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "40px 20px",
        backgroundColor: "#ffffff",
        color: "#171717",
      }}
    >
      {/* Header with Logo */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <img
          src="https://phion.dev/brand/light.png"
          alt="Phion"
          style={{
            width: "48px",
            height: "48px",
            marginBottom: "16px",
          }}
        />
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "600",
            margin: "0",
            color: "#171717",
            lineHeight: "1.3",
          }}
        >
          Welcome to Phion Beta
        </h1>
      </div>

      {/* Main Content */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "16px",
            color: "#171717",
            marginBottom: "16px",
            lineHeight: "1.5",
            margin: "0 0 16px 0",
          }}
        >
          Hi {name},
        </p>

        <p
          style={{
            fontSize: "16px",
            color: "#171717",
            marginBottom: "16px",
            lineHeight: "1.5",
            margin: "0 0 16px 0",
          }}
        >
          Your application for Phion early access has been approved. We're excited to have you as
          one of our beta testers.
        </p>

        <p
          style={{
            fontSize: "16px",
            color: "#171717",
            marginBottom: "32px",
            lineHeight: "1.5",
            margin: "0 0 32px 0",
          }}
        >
          Phion helps you deploy and iterate on your projects faster. Get ready to supercharge your
          development workflow.
        </p>

        {/* CTA Buttons */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <table style={{ margin: "0 auto", borderCollapse: "collapse" }}>
            <tr>
              <td style={{ padding: "0 8px 0 0", verticalAlign: "middle" }}>
                <a
                  href="https://phion.dev"
                  style={{
                    display: "inline-block",
                    backgroundColor: "#171717",
                    color: "#ffffff",
                    padding: "12px 24px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: "500",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Start Building with Phion
                </a>
              </td>
              <td style={{ padding: "0 0 0 8px", verticalAlign: "middle" }}>
                <a
                  href={discordInvite}
                  style={{
                    color: "#6366f1",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Join Beta Discord
                </a>
              </td>
            </tr>
          </table>
        </div>
      </div>

      {/* Benefits */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "600",
            margin: "0 0 16px 0",
            color: "#171717",
          }}
        >
          What you get:
        </h3>
        <ul
          style={{
            fontSize: "14px",
            color: "#171717",
            lineHeight: "1.6",
            paddingLeft: "20px",
            margin: "0",
          }}
        >
          <li style={{ marginBottom: "4px" }}>Early access to new features</li>
          <li style={{ marginBottom: "4px" }}>Direct feedback channel with our team</li>
          <li style={{ marginBottom: "4px" }}>Priority support</li>
          <li style={{ marginBottom: "4px" }}>Beta community access</li>
        </ul>
      </div>

      {/* Next Steps */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "20px",
          borderRadius: "6px",
          marginBottom: "32px",
          border: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: "600",
            margin: "0 0 12px 0",
            color: "#171717",
          }}
        >
          Getting Started:
        </h3>
        <div
          style={{
            fontSize: "14px",
            color: "#171717",
            lineHeight: "1.5",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            1. Click "Start Building with Phion" to create your first project
          </div>
          <div style={{ marginBottom: "4px" }}>2. Follow the built-in onboarding guide</div>
          <div>3. Join our Discord for community support</div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          borderTop: "1px solid rgba(0, 0, 0, 0.05)",
          paddingTop: "20px",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            color: "#666666",
            margin: "0 0 12px 0",
            lineHeight: "1.4",
          }}
        >
          Thanks for joining us on this journey!
          <br />
          Serafim from Phion
        </p>

        <p
          style={{
            fontSize: "12px",
            color: "#999999",
            margin: "0 0 8px 0",
            lineHeight: "1.4",
          }}
        >
          Questions? Reply to this email or reach out in Discord.
        </p>

        <p
          style={{
            fontSize: "12px",
            color: "#999999",
            margin: "0",
            lineHeight: "1.4",
          }}
        >
          Built by the 21st.dev team
        </p>
      </div>
    </div>
  )
}
