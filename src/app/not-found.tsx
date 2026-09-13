import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="icerik" className="page prose">
        <h1 className="board-title" style={{ marginBottom: "1rem" }}>
          Bu sayfa yok
        </h1>
        <p>Ders bu dönem açılmamış ya da link hatalı olabilir.</p>
        <p>
          <Link href="/ozyegin" className="btn btn-pen">
            Planlayıcıyı aç
          </Link>
        </p>
      </main>
    </>
  );
}
