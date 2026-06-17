import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import Home from "@/pages/Home";
import Presentation from "@/pages/Presentation";
import Share from "@/pages/Share";
import About from "@/pages/About";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/s/:id" element={<Presentation />} />
            <Route path="/s/:id/share" element={<Share />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
