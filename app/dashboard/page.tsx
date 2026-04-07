import Image from "next/image";
import { bricolage, spaceMono } from "../fonts/fonts";
import Gifts from "../components/tabs";

export default function home() {
  return (
    <main className={`bg-purple-400 min-h-screen py-20 ${spaceMono.className}`}>
      <section className="w-[900px] mx-auto p-10 bg-white my-10 rounded-[35px] flex flex-col gap-10 border-[6px] border-black shadow-[-5px_5px_0_0_rgba(0,0,0)]">
        <div className="flex flex-row items-center gap-10">
          <img
            height={200}
            width={200}
            alt="profile pic"
            src="https://www.madlads.com/_next/image?url=https%3A%2F%2Fmadlads.s3.us-west-2.amazonaws.com%2Fimages%2F1.png&w=1200&q=75"
            className="h-[100px] w-[100px] object-cover rounded-full overflow-hidden"
          />
          <h1 className="text-3xl">Christopher</h1>
        </div>

        <Gifts />
      </section>
    </main>
  );
}
