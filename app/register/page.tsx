import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-6 py-16">
      <h1 className="mb-4 text-2xl font-semibold">Inscription</h1>
      <p className="text-sm text-zinc-600">
        Les inscriptions sont actuellement fermées. Si tu as déjà un compte, tu peux te connecter.
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
