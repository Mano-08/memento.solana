import { Sparkle } from "lucide-react";

export function SparkleCluster() {
  return (
    <span className="w-[300px] absolute inline-block">
      <Sparkle className="sp1" size={14} />
      <Sparkle className="sp2" size={20} />
      <Sparkle className="sp3" size={11} />
    </span>
  );
}
