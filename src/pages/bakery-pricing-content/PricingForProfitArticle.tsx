import { ArticleLayout } from './ArticleLayout'

export default function PricingForProfitArticle() {
  return (
    <ArticleLayout
      title="How to Price Baked Goods for Profit (Without Guessing)"
      intro="A lot of home bakers price by feel — double the ingredient cost, round to a friendly number, hope it works out. Here's a steadier way to get to a price you can actually stand behind."
      related={[
        { href: '/bakery-food-cost-vs-margin', title: 'Food Cost vs. Profit Margin: What’s the Difference for Bakers?' },
        { href: '/bakery-labor-cost', title: 'How to Calculate Your Labor Cost for Cakes and Baked Goods' },
        { href: '/bakery-packaging-waste-overhead', title: 'Packaging, Waste, and Overhead: The Costs Bakers Forget to Charge For' },
      ]}
    >
      <h2>Why "guessing" quietly costs you money</h2>
      <p>
        If you've ever priced a cake by doubling what the ingredients cost, you're not alone — it's one of the
        most common starting points for home bakers. The trouble is that ingredient cost is only one piece of
        what a recipe actually costs you. Your time, your packaging, the occasional ruined batch, and
        the ordinary costs of running a small food business all belong in the number too. Leave them out often
        enough, and you can stay busy while barely breaking even.
      </p>

      <h2>The five costs that make up your true cost</h2>
      <p>A complete recipe cost is usually built from five pieces:</p>
      <ul>
        <li><strong>Ingredients</strong> — what everything in the recipe actually cost you, per the amount used.</li>
        <li><strong>Labor</strong> — your own active working time: shopping, prepping, decorating, packaging, cleanup, and customer communication.</li>
        <li><strong>Packaging &amp; supplies</strong> — boxes, liners, ribbon, cake boards, and anything else that leaves with the order.</li>
        <li><strong>Waste</strong> — spills, trimming, a burnt batch, a rejected order — the ordinary cost of things not going perfectly every time.</li>
        <li><strong>Overhead</strong> — the recurring costs of running the business at all: permits, insurance, utilities, and similar.</li>
      </ul>
      <p>
        Add those five together and you have your <strong>total production cost</strong> — what the recipe
        genuinely costs you to make, before you've decided to earn anything on top of it.
      </p>

      <h2>From cost to price: adding a margin</h2>
      <p>
        Once you know your true cost, a price is a decision about how much of your final selling price you want
        to keep as profit — your <strong>margin</strong>. A margin isn't extra padding on top of your costs; it's
        what's left over for the business itself, to cover the ordinary risk of running it, to build a reserve
        for slow seasons, and to grow. There's no single "correct" margin that fits every baker or every recipe —
        it's a number you choose deliberately, not one this article (or anyone else) can hand you.
      </p>

      <h2>Round up, and use the same method every time</h2>
      <p>
        Two small habits make pricing far more consistent: rounding your final price <em>up</em> rather than
        down (so you never quietly absorb the difference), and running every recipe through the same five-cost
        framework rather than eyeballing it case by case. Consistency is what turns pricing from a guess into a
        repeatable habit.
      </p>

      <h2>Try it with your own recipe</h2>
      <p>
        The <a href="/tools-bakery-pricing">Free Home Bakery Pricing Calculator</a> walks through exactly this —
        ingredients, labor, packaging, waste, and overhead — and shows you a suggested price built from your own
        numbers, with the full math laid out so nothing is a black box.
      </p>
    </ArticleLayout>
  )
}
