import "@/styles/globals.css";
import Link from 'next/link';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <nav>
        <Link href="/">Home</Link> | <Link href="/simulate">Simulator</Link>
      </nav>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
