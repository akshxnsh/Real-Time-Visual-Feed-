import "./globals.css";
import SentimentDebugPanel from "../components/SentimentDebugPanel";

export const metadata = {
  title: "RTVLF — Real-Time Visual Learning Feed",
  description: "AI-generated short-form educational and entertaining content",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-atmosphere" aria-hidden="true">
          <div className="app-atmosphere__layer app-atmosphere__layer--base" />
          <div className="app-atmosphere__layer app-atmosphere__layer--orb-tl" />
          <div className="app-atmosphere__layer app-atmosphere__layer--orb-br" />
          <div className="app-atmosphere__layer app-atmosphere__layer--grain" />
        </div>
        <div className="app-shell">{children}</div>
        <SentimentDebugPanel />
      </body>
    </html>
  );
}
