import styles from './layout.module.scss'

export async function generateMetadata() {
  return {
    title: `Papers`,
  }
}

export default async function LocaleLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>
}
