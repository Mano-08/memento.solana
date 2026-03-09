import { ConnectButton } from "./connect-button";

export default function Navbar() {
  return (
    <nav className="top-5 w-full fixed z-50">
      <div className="flex flex-row items-center justify-between mx-auto p-2 rounded-[20px] bg-black text-black max-w-[500px]">
        <ConnectButton />
      </div>
    </nav>
  );
}
