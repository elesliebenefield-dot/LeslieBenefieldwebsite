import { ArticleLayout } from './ArticleLayout'

export default function PackagingWasteOverheadArticle() {
  return (
    <ArticleLayout
      title="Packaging, Waste, and Overhead: The Costs Bakers Forget to Charge For"
      intro="Ingredients and labor get most of the attention when pricing a recipe. These three costs are easy to forget — and they add up more than most bakers expect."
      related={[
        { href: '/bakery-pricing-for-profit', title: 'How to Price Baked Goods for Profit (Without Guessing)' },
        { href: '/bakery-food-cost-vs-margin', title: 'Food Cost vs. Profit Margin: What’s the Difference for Bakers?' },
        { href: '/bakery-labor-cost', title: 'How to Calculate Your Labor Cost for Cakes and Baked Goods' },
      ]}
    >
      <h2>Packaging &amp; supplies: anything that leaves with the order</h2>
      <p>
        Boxes, cake boards, bags, liners, labels, ribbon, parchment, sticks, dowels, disposable trays — anything
        that's used up or goes home with the customer belongs in your cost, even when each individual item is
        cheap. A $0.40 box feels negligible until it's on every order for a year.
      </p>
      <p>
        One useful distinction: <strong>reusable equipment</strong> — mixers, pans, decorating tools, anything
        you use again and again — isn't a packaging cost for a single order. It belongs in overhead instead (see
        below), spread across everything you make, not charged fresh to one recipe.
      </p>

      <h2>Waste: the ordinary cost of things not going perfectly</h2>
      <p>
        Waste covers spills, trimming, a broken or rejected item, leftovers, a test batch, or an outright failed
        batch. None of that is a sign you're doing something wrong — it's a normal part of baking, and pricing
        that assumes zero waste is pricing for a version of your process that doesn't quite exist.
      </p>
      <p>
        The most reliable way to estimate it isn't to pick a percentage out of the air — it's to track a handful
        of real batches and see what you actually lose, then use that as your own starting point.
      </p>

      <h2>Overhead: the costs that exist even between orders</h2>
      <p>
        Overhead is everything that keeps the business running whether or not you sold anything that week —
        permits and licenses, insurance, utilities, cleaning supplies, equipment replacement, your
        website/software/phone, marketing, and mileage or delivery expenses are common examples. None of it is
        tied to one specific recipe, which is exactly why it's easy to leave out of a per-recipe price — but it's
        a real cost of doing business, and a price that ignores it is quietly being subsidized by something else.
      </p>
      <p>
        A simple way to bring it into a single recipe's price: total your monthly overhead, estimate how many
        batches or orders you expect in a typical month, and divide — an allocation based on your own numbers,
        not a market benchmark.
      </p>

      <h2>Small numbers, real totals</h2>
      <p>
        None of these three costs look dramatic on their own. Skip all three at once, though, and it's easy to
        end up pricing a recipe as if it only cost ingredients and time — which is rarely close to the truth.
      </p>

      <h2>Let the calculator carry these for you</h2>
      <p>
        The <a href="/tools-bakery-pricing">Free Bakery Pricing Calculator</a> has a dedicated place for
        each of these three costs, including optional helpers for estimating overhead per batch and converting a
        personal waste estimate into a percentage — so none of them have to be tracked in your head.
      </p>
    </ArticleLayout>
  )
}
