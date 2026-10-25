const products = [
  {
    name: 'Drixel SA',
    label: 'Fashion & commerce',
    description: 'Shop, orders, customer experiences and the Drixel SA brand ecosystem.',
    href: 'https://drixelsa.co.za',
    mark: 'DS',
    state: 'Live',
  },
  {
    name: 'Excel Tutoring Academy SA',
    label: 'Education',
    description: 'Learning, live classes, resources and student access in one education workspace.',
    href: 'https://exceltutoringacademysa.co.za',
    mark: 'EX',
    state: 'Platform',
  },
  {
    name: 'DrixelOne',
    label: 'Technology',
    description: 'The shared technology layer connecting Drixel products, data and digital services.',
    href: '/services',
    mark: 'D1',
    state: 'Building',
  },
  {
    name: 'A-Chatz',
    label: 'Communication',
    description: 'Messaging, communities, channels, stories and intelligent collaboration.',
    href: '/services',
    mark: 'AC',
    state: 'Building',
  },
]

const capabilities = [
  ['One identity', 'Use Drixel ID as the common identity layer across approved Drixel products.'],
  ['Scoped access', 'Business and service permissions stay separate, auditable and intentional.'],
  ['One ecosystem', 'Move between Drixel businesses without the platform feeling like disconnected websites.'],
]

export default function Ecosystem() {
  return (
    <div className="ecosystem-shell">
      <header className="ecosystem-nav">
        <a className="ecosystem-brand" href="/" aria-label="Drixel Accounts home">
          <span className="ecosystem-brand-word">DRIXEL</span>
          <span className="ecosystem-brand-sub">ACCOUNTS</span>
        </a>
        <nav className="ecosystem-nav-links" aria-label="Ecosystem navigation">
          <a href="#products">Products</a>
          <a href="#identity">Identity</a>
          <a href="/overview">Administration</a>
        </nav>
        <a className="ecosystem-signin" href="/accounts">Open account</a>
      </header>

      <main>
        <section className="ecosystem-hero">
          <div className="ecosystem-hero-copy">
            <span className="ecosystem-kicker">DRIXEL LABS INC · ONE ACCOUNT</span>
            <h1>One secure account for the Drixel ecosystem.</h1>
            <p>
              Drixel Accounts is the identity and access home for Drixel Labs products — built to connect commerce,
              education, technology and communication without turning them into one confusing application.
            </p>
            <div className="ecosystem-hero-actions">
              <a className="ecosystem-primary" href="/accounts">Sign in with Drixel ID</a>
              <a className="ecosystem-secondary" href="#products">Explore the ecosystem</a>
            </div>
            <div className="ecosystem-domain">www.accounts.drixelsa.co.za</div>
          </div>

          <div className="ecosystem-command-card" aria-label="Drixel ecosystem access preview">
            <div className="ecosystem-command-top">
              <span className="ecosystem-command-dot" />
              <span>Drixel account</span>
              <span className="ecosystem-command-secure">SECURE ACCESS</span>
            </div>
            <div className="ecosystem-avatar">DL</div>
            <strong>Your Drixel identity</strong>
            <p>One identity. Access only to the businesses and services assigned to you.</p>
            <div className="ecosystem-access-row"><span>Drixel SA</span><b>Connected</b></div>
            <div className="ecosystem-access-row"><span>Excel Tutoring</span><b>Scoped</b></div>
            <div className="ecosystem-access-row"><span>DrixelOne</span><b>Managed</b></div>
          </div>
        </section>

        <section className="ecosystem-trust-strip" aria-label="Platform principles">
          <span>OIDC + PKCE</span>
          <span>Role-based access</span>
          <span>Audit history</span>
          <span>Business-scoped permissions</span>
        </section>

        <section className="ecosystem-section" id="products">
          <div className="ecosystem-section-heading">
            <div>
              <span className="ecosystem-kicker">THE GROUP</span>
              <h2>Products with their own identity.<br />Connected by one platform.</h2>
            </div>
            <p>Each Drixel business remains focused on its own customers and purpose while sharing trusted group infrastructure.</p>
          </div>

          <div className="ecosystem-product-grid">
            {products.map((product) => (
              <a className="ecosystem-product" href={product.href} key={product.name}>
                <div className="ecosystem-product-head">
                  <span className="ecosystem-product-mark">{product.mark}</span>
                  <span className="ecosystem-product-state">{product.state}</span>
                </div>
                <span className="ecosystem-product-label">{product.label}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <span className="ecosystem-product-link">Open product <span>↗</span></span>
              </a>
            ))}
          </div>
        </section>

        <section className="ecosystem-identity" id="identity">
          <div className="ecosystem-identity-panel">
            <span className="ecosystem-kicker ecosystem-kicker-light">DRIXEL ID</span>
            <h2>The identity layer behind the group.</h2>
            <p>
              Authentication is shared; authorization is not. Your Drixel identity can be recognized across products while
              access remains controlled by business, service and role.
            </p>
            <a href="/accounts">Manage account access</a>
          </div>
          <div className="ecosystem-capability-list">
            {capabilities.map(([title, description], index) => (
              <div className="ecosystem-capability" key={title}>
                <span>0{index + 1}</span>
                <div><strong>{title}</strong><p>{description}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="ecosystem-admin-callout">
          <div>
            <span className="ecosystem-kicker">FOR AUTHORIZED TEAM MEMBERS</span>
            <h2>Manage the group from one control plane.</h2>
            <p>Businesses, services, accounts, roles and audit history remain inside the secure Drixel administration console.</p>
          </div>
          <a className="ecosystem-primary ecosystem-primary-dark" href="/overview">Open administration</a>
        </section>
      </main>

      <footer className="ecosystem-footer">
        <div><strong>DRIXEL</strong><span>LABS INC</span></div>
        <p>Drixel Accounts · Identity and access for the Drixel ecosystem.</p>
        <a href="/settings">System settings</a>
      </footer>
    </div>
  )
}
