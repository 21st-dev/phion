"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import Link from "next/link"

export default function FAQSection() {
  const faqItems = [
    {
      id: "item-1",
      question: "Do I need a GitHub account?",
      answer:
        "No! You just need to sign up with Google or GitHub (for authentication only). We handle all the code storage and version control for you automatically.",
    },
    {
      id: "item-2",
      question: "Where is my project hosted?",
      answer:
        "Your project is automatically deployed to Netlify with a free live URL. No setup required - just code and we handle the hosting.",
    },
    {
      id: "item-3",
      question: "Can I use my existing project with Phion?",
      answer:
        "Currently, you need to create a new project through Phion. We provide ready-to-use templates, and you can copy your existing code into the new project.",
    },
    {
      id: "item-4",
      question: "What framework does the template use?",
      answer:
        "Our current template uses Vite + React with TypeScript and Tailwind CSS. We're also working on a Next.js template that will be available soon.",
    },
    {
      id: "item-5",
      question: "How is this different from Lovable.dev?",
      answer:
        "Phion focuses on local development with Cursor while providing instant deployment. You code locally with AI assistance, we handle the infrastructure - no browser-based coding required.",
    },
    {
      id: "item-6",
      question: "What editors can I use?",
      answer:
        "Phion is designed specifically for Cursor with special integrations that auto-start your project and open previews. Cursor's AI capabilities make it the perfect match for rapid development.",
    },
    {
      id: "item-7",
      question: "How much does it cost?",
      answer:
        "You get 2 projects completely free! For more projects, check out our pricing at 21st.dev/pricing - Phion is part of the 21st.dev suite of development tools.",
    },
    {
      id: "item-8",
      question: "What happens to my code?",
      answer:
        "Your code is safely stored in a private GitHub repository that you can access anytime. Even if you stop using Phion, your code remains yours.",
    },
  ]

  return (
    <section className="py-16 md:py-24 bg-[#08090A]">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-white/70 mt-4 text-balance">
            Get quick answers to common questions about getting started with Phion.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-xl">
          <Accordion type="single" collapsible className="bg-white/5 w-full rounded-2xl p-1">
            {faqItems.map((item) => (
              <div className="group" key={item.id}>
                <AccordionItem
                  value={item.id}
                  className="data-[state=open]:bg-white/10 peer rounded-xl border-none px-7 py-1 data-[state=open]:border-none data-[state=open]:shadow-sm"
                >
                  <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-white hover:text-white/80">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-base text-white/70">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
                <hr className="mx-7 border-dashed border-white/20 group-last:hidden peer-data-[state=open]:opacity-0" />
              </div>
            ))}
          </Accordion>

          <p className="text-white/70 mt-6 px-8 text-center">
            Still have questions? Join our{" "}
            <Link href="https://discord.gg/j4ZMYnMeJN" className="text-white font-medium hover:underline">
              Discord community
            </Link>{" "}
            or reach out to our support team.
          </p>
        </div>
      </div>
    </section>
  )
}
