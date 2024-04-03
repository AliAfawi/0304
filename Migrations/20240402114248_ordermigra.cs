using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookShop.Migrations
{
    /// <inheritdoc />
    public partial class ordermigra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Books_Orders_OrderID",
                table: "Books");

            migrationBuilder.DropIndex(
                name: "IX_Books_OrderID",
                table: "Books");

            migrationBuilder.DropColumn(
                name: "OrderID",
                table: "Books");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrderID",
                table: "Books",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Books_OrderID",
                table: "Books",
                column: "OrderID");

            migrationBuilder.AddForeignKey(
                name: "FK_Books_Orders_OrderID",
                table: "Books",
                column: "OrderID",
                principalTable: "Orders",
                principalColumn: "OrderID");
        }
    }
}
