namespace BookShop.Models
{
    public class Order
    {
        public int OrderID { get; set; }
        public int qty { get; set; }
        public float TotalPrice { get; set; }
        public DateTime OrderDate { get; set; }

        public ICollection <OrderBooks> OrderBooks { get; set; }

        public User User { get; set; }
        // Navigation property for OrderDetails
    }
}
