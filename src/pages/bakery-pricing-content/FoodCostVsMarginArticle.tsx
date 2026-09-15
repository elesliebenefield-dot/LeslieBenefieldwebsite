import { ArticleLayout } from './ArticleLayout'

export default function FoodCostVsMarginArticle() {
  return (
    <ArticleLayout
      title="Food Cost vs. Profit Margin: What's the Difference for Bakers?"
      intro="“Food cost,” “margin,” and “markup” get used interchangeably a lot — and mixing them up is one of the quieter ways home bakers end up underpriced."
      related={[
        { href: '/bakery-pricing-for-profit', title: 'How to Price Baked Goods for Profit (Without Guessing)' },
        { href: '/bakery-labor-cost', title: 'How to Calculate Your Labor Cost for Cakes and Baked Goods' },
        { href: '/bakery-packaging-waste-overhead', title: 'Packaging, Waste, and Overhead: The Costs Bakers Forget to Charge For' },
      ]}
    >
      <h2>What "food cost" actually means</h2>
      <p>
        Food cost is just what your ingredients cost for a given recipe or order — nothing else. It's a useful
        number on its own, but it's easy to mistake it for your <em>whole</em> cost. A cookie's food cost might be
        a small fraction of what you sell it for, which can make the price look like mostly profit — until labor,
        packaging, waste, and overhead are accounted for too.
      </p>

      <h2>What "profit margin" actually means</h2>
      <p>
        Margin is the percentage of your final selling price that's left over <em>after every cost is paid</em> —
        ingredients, labor, packaging, waste, and overhead together, not just ingredients. A recipe can have a low
        food-cost percentage and still be barely profitable once the rest of the true cost is included. Margin is
        the number that helps you evaluate whether a price genuinely supports your business, rather than just
        covering ingredients.
      </p>

      <h2>Margin vs. markup — the mix-up inside the mix-up</h2>
      <p>
        Even once "cost" and "margin" are sorted out, margin and markup still get swapped for each other:
      </p>
      <ul>
        <li><strong>Margin</strong> is profit as a percentage of your <em>selling price</em>.</li>
        <li><strong>Markup</strong> is profit as a percentage of your <em>cost</em>.</li>
      </ul>
      <p>
        The same dollar amount of profit produces two different-looking percentages depending on which one you
        use — a 50% markup and a 33% margin can describe the exact same price. Neither number is wrong, but
        using them interchangeably in your own head is a fast way to talk yourself into a lower price than you
        meant to.
      </p>

      <h2>Why this mix-up quietly underprices bakers</h2>
      <p>
        A common pattern: a baker checks their food cost, sees it's low, and feels like there's plenty of room —
        without ever pricing in their own time or the business's other recurring costs. The ingredients genuinely
        were cheap; the recipe as a whole wasn't nearly as profitable as the food-cost number suggested.
      </p>

      <h2>Keep the three numbers straight</h2>
      <p>
        The <a href="/tools-bakery-pricing">Free Bakery Pricing Calculator</a> shows your ingredient
        subtotal, your full cost breakdown, and your suggested price's margin <em>and</em> its equivalent
        markup side by side — so you can see all three numbers at once instead of guessing which one you're
        actually thinking in.
      </p>
    </ArticleLayout>
  )
}
