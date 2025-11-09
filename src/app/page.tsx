import Logo from "@/components/logo";

export default function HomePage() {
  return (
    <div className="w-full lg:min-h-screen flex items-center justify-center">
      <div className="mx-auto grid w-[450px] gap-6 text-center">
        <Logo className="mx-auto h-12 w-auto" />
        <h1 className="text-4xl font-bold font-headline mt-4">Hello SmartLearn</h1>
      </div>
    </div>
  );
}
