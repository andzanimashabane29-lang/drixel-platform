const products = [
  {
    name: 'Drixel SA',
    label: 'Commerce',
    description: 'Fashion, customer experience, orders and retail operations.',
    href: 'https://drixelsa.co.za',
    state: 'Live',
  },
  {
    name: 'Excel Tutoring Academy SA',
    label: 'Education',
    description: 'Learning, live classes, resources and student access.',
    href: 'https://exceltutoringacademysa.co.za',
    state: 'Platform',
  },
  {
    name: 'DrixelOne',
    label: 'Technology',
    description: 'Shared technology, data and digital infrastructure for the group.',
    href: '/services',
    state: 'In development',
  },
  {
    name: 'A-Chatz',
    label: 'Communication',
    description: 'Messaging, communities, channels and collaboration.',
    href: '/services',
    state: 'In development',
  },
]

export default function Ecosystem() {
  return (
    <div className="ecosystem-shell">
      <header className="ecosystem-nav">
        <a className="ecosystem-brand" href="/" aria-label="Drixel Accounts home">
          <span>DRIXEL</span>
          <small>LABS INC</small>
        </a>
        <nav className="ecosystem-nav-links" aria-label="Ecosystem navigation">
          <a href="#group">Group</a>
          <a href="#identity">Drixel ID</a>
          <a href="/overview">Administration</a>
        </nav>
        <a className="ecosystem-signin" href="/accounts">Sign in</a>
      </header>

      <main>
        <section className="ecosystem-hero">
          <div className="ecosystem-hero-copy">
            <span className="ecosystem-kicker">DRIXEL ACCOUNTS</span>
            <h1>One account.<br />Across Drixel.</h1>
            <p>
              A shared identity layer for Drixel Labs businesses and products. Sign in once, then access only the services and workspaces assigned to you.
            </p>
            <div className="ecosystem-hero-actions">
              <a className="ecosystem-primary" href="/accounts">Continue with Drixel ID</a>
              <a className="ecosystem-text-link" href="#group">View the group</a>
            </div>
          </div>
          <div className="ecosystem-hero-meta" aria-label="Platform information">
            <div><span>Platform</span><strong>Drixel Accounts</strong></div>
            <div><span>Identity</span><strong>Drixel ID</strong></div>
            <div><span>Access model</span><strong>Business-scoped</strong></div>
            <div><span>Administration</span><strong>Role controlled</strong></div>
          </div>
        </section>

        <section className="ecosystem-principles" aria-label="Platform principles">
          <span>01</span><p>One identity</p>
          <span>02</span><p>Scoped permissions</p>
          <span>03</span><p>Auditable access</p>
          <span>04</span><p>Independent products</p>
        </section>

        <section className="ecosystem-section" id="group">
          <div className="ecosystem-section-heading">
            <span className="ecosystem-kicker">DRIXEL LABS GROUP</span>
            <h2>Distinct businesses.<br />Shared infrastructure.</h2>
            <p>Each business keeps its own product, customers and operating model while using common group services where it makes sense.</p>
          </div>

          <div className="ecosystem-product-list">
            {products.map((product, index) => (
              <a className="ecosystem-product-row" href={product.href} key={product.name}>
                <span className="ecosystem-product-index">0{index + 1}</span>
                <div className="ecosystem-product-main">
                  <span>{product.label}</span>
                  <h3>{product.name}</h3>
                </div>
                <p>{product.description}</p>
                <div className="ecosystem-product-end"><span>{product.state}</span><b>↗</b></div>
              </a>
            ))}
          </div>
        </section>

        <section className="ecosystem-identity" id="identity">
          <div className="ecosystem-identity-heading">
            <span className="ecosystem-kicker ecosystem-kicker-light">DRIXEL ID</span>
            <h2>Shared identity.<br />Separate authority.</h2>
          </div>
          <div className="ecosystem-identity-copy">
            <p>
              Drixel ID lets a person be recognized across the group without giving them blanket access. Authentication can be shared while permissions remain specific to each business, service and role.
            </p>
            <div className="ecosystem-identity-rule"><span>Authentication</span><strong>Shared</strong></div>
            <div className="ecosystem-identity-rule"><span>Authorization</span><strong>Scoped</strong></div>
            <div className="ecosystem-identity-rule"><span>Activity</span><strong>Auditable</strong></div>
            <a href="/accounts">Manage account access →</a>
          </div>
        </section>

        <section className="ecosystem-admin-callout">
          <span className="ecosystem-kicker">GROUP ADMINISTRATION</span>
          <div>
            <h2>Manage businesses, services and access from one control plane.</h2>
            <a className="ecosystem-primary ecosystem-primary-light" href="/overview">Open administration</a>
          </div>
        </section>
      </main>

      <footer className="ecosystem-footer">
        <div className="ecosystem-footer-brand">DRIXEL <span>LABS INC</span></div>
        <p>Identity and access infrastructure for the Drixel ecosystem.</p>
        <div className="ecosystem-footer-links"><a href="/settings">Settings</a><a href="/overview">Admin</a></div>
      </footer>
    </div>
  )
}
