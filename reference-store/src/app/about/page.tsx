"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { storeInfo, storeUrl } from "@/lib/data";

export default function AboutPage() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            About {storeInfo.name}
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {storeInfo.about}
            </p>

            <h2>Our Mission</h2>
            <p>{storeInfo.mission}</p>

            <h2>Get in Touch</h2>
            <p>
              Have questions? We would love to hear from you.
            </p>
            <ul>
              {storeInfo.emails.map(email => (
                <li key={email}>
                  Email: <a href={`mailto:${email}`}>{email}</a>
                </li>
              ))}
              {storeInfo.phones.map(phone => (
                <li key={phone}>
                  Phone: <a href={`tel:${phone}`}>{phone}</a>
                </li>
              ))}
              <li>Address: {storeInfo.address}</li>
            </ul>
          </div>
        </motion.div>
      </main>
      <Footer />
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug="example-store"
      />
    </>
  );
}
