import { Routes, Route } from "react-router-dom";
import { useBootstrap } from "@/hooks/useBootstrap";
import { NavBar } from "@/components/NavBar";
import { AlertToast } from "@/components/AlertToast";
import { GridPage } from "@/pages/Grid";
import { ResidentDetail } from "@/pages/ResidentDetail";
import { AlertLog } from "@/pages/AlertLog";
import { MovementsPage } from "@/pages/Movements";
import { StaffPage } from "@/pages/StaffPage";
import { BraceletPage } from "@/pages/Bracelet";
import { DemoPage } from "@/pages/Demo";

export default function App() {
  useBootstrap();
  return (
    <div className="min-h-full">
      <NavBar />
      <main className="lg:pl-60">
        <Routes>
          <Route path="/" element={<GridPage />} />
          <Route path="/resident/:id" element={<ResidentDetail />} />
          <Route path="/alerts" element={<AlertLog />} />
          <Route path="/movements" element={<MovementsPage />} />
          <Route path="/bracelet" element={<BraceletPage />} />
          <Route path="/personnel" element={<StaffPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="*" element={<div className="p-8 text-zinc-400">Page introuvable</div>} />
        </Routes>
      </main>
      <AlertToast />
    </div>
  );
}
