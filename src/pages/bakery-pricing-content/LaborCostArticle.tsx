import { ArticleLayout } from './ArticleLayout'

export default function LaborCostArticle() {
  return (
    <ArticleLayout
      title="How to Calculate Your Labor Cost for Cakes and Baked Goods"
      intro="Labor is the cost home bakers skip most often — usually because paying yourself for your own time feels optional. It isn't, if the price is supposed to reflect the real cost of the order."
      related={[
        { href: '/bakery-pricing-for-profit', title: 'How to Price Baked Goods for Profit (Without Guessing)' },
        { href: '/bakery-food-cost-vs-margin', title: 'Food Cost vs. Profit Margin: What’s the Difference for Bakers?' },
        { href: '/bakery-packaging-waste-overhead', title: 'Packaging, Waste, and Overhead: The Costs Bakers Forget to Charge For' },
      ]}
    >
      <h2>Labor pays you — profit is something separate</h2>
      <p>
        It helps to separate two ideas that get blended together a lot: labor pays <em>you</em> for the time you
        spend on an order. Profit — your margin — belongs to the business itself, to cover risk, growth, and
        eventually replacing worn-out equipment. If labor never shows up as its own line, you're often
        unknowingly funding your "profit" with unpaid hours.
      </p>

      <h2>What counts as active time (and what doesn't)</h2>
      <p>
        Active labor is time you're genuinely working on the order — it does not automatically include time the
        oven or the fridge is doing the work without you. A reasonable way to break it down:
      </p>
      <ul>
        <li>Shopping and ingredient pickup</li>
        <li>Preparation and mixing</li>
        <li>Active baking supervision (checking on it, not standing there for the whole bake)</li>
        <li>Cooling and decorating</li>
        <li>Packaging</li>
        <li>Cleanup</li>
        <li>Customer communication</li>
        <li>Delivery or handoff</li>
      </ul>
      <p>
        Passive time — dough resting, a cake baking untouched, frosting setting in the fridge — isn't counted
        here unless you're actually working during it. The goal isn't to inflate the number; it's to capture the
        real time you're not spending on anything else.
      </p>

      <h2>Setting an hourly rate for yourself</h2>
      <p>
        There's no single hourly rate that's correct for every baker, every recipe, or every area — anyone who
        tells you otherwise is guessing on your behalf. Two questions tend to help more than a formula:
      </p>
      <ul>
        <li>What would make this work genuinely worth your time?</li>
        <li>What would you need to pay someone else with comparable skill to do it?</li>
      </ul>
      <p>It's a number you're deciding for yourself, based on your own situation — not one to copy from someone else's post online.</p>

      <h2>A simple worked example</h2>
      <p>
        Say a batch of decorated cookies takes you 20 minutes of prep, 15 minutes of decorating, and 10 minutes
        of packaging — 45 minutes total — and you've decided your time is worth $20/hour. That's{' '}
        <code>45 ÷ 60 × $20 = $15</code> in labor for the batch, entirely separate from what the ingredients cost.
        This example is only illustrative — your own minutes and your own rate are what belong in your actual
        price.
      </p>

      <h2>Let the calculator do the arithmetic</h2>
      <p>
        The <a href="/tools-bakery-pricing">Free Home Bakery Pricing Calculator</a> includes an optional
        active-minutes checklist matching the list above, so you can total up your real time without doing the
        math by hand — while your hourly rate always stays something you enter and decide for yourself.
      </p>
    </ArticleLayout>
  )
}
