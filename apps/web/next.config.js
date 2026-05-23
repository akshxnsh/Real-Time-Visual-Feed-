import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load root .env so GROQ_API_KEY is available to Next.js server-side code
// (Express loads it at runtime; Next.js needs it at build + server start)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
