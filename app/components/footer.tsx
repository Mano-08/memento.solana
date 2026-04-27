import Link from "next/link";

export default function Navbar() {
  return (
    <footer className="flex flex-col w-full items-center min-h-20 bg-neutral-100">
      <div className="items-center justify-between "></div>
      <div className="flex flex-row items-center justify-between py-2 px-5 w-full text-xs text-black/50 border-t border-solid border-black/60">
        <div>
          Copyright &copy; 2026{" "}
          <Link href="/" className="text-black hover:underline cursor-pointer">
            SolGift
          </Link>
          . All rights reserved.
        </div>
        <Link href="/">Terms and Conditions</Link>
      </div>
    </footer>
  );
}
